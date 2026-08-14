package com.campus.backend.service;

import com.campus.backend.dto.CreateTicketRequest;
import com.campus.backend.dto.TicketDTO;
import com.campus.backend.exception.ResourceNotFoundException;
import com.campus.backend.exception.ValidationException;
import com.campus.backend.model.Ticket;
import com.campus.backend.model.TicketComment;
import com.campus.backend.model.TicketStatus;
import com.campus.backend.model.NotificationType;
import com.campus.backend.model.Role;
import com.campus.backend.model.User;
import com.campus.backend.repository.UserRepository;
import com.campus.backend.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TicketService {

    private final TicketRepository ticketRepository;
    private final NotificationService notificationService;
    private final ResourceService resourceService;
    private final UserRepository userRepository;

    /**
     * Valid status transitions.
     * OPEN → IN_PROGRESS or CLOSED(rejected before assignment)
     * IN_PROGRESS → RESOLVED or REJECTED
     * RESOLVED → CLOSED
     * CLOSED and REJECTED are terminal states.
     */
    private static final Map<TicketStatus, Set<TicketStatus>> VALID_TRANSITIONS = Map.of(
            TicketStatus.OPEN,        Set.of(TicketStatus.IN_PROGRESS, TicketStatus.REJECTED),
            TicketStatus.IN_PROGRESS, Set.of(TicketStatus.RESOLVED, TicketStatus.REJECTED),
            TicketStatus.RESOLVED,    Set.of(TicketStatus.CLOSED),
            TicketStatus.CLOSED,      Set.of(),
            TicketStatus.REJECTED,    Set.of()
    );

    /**
     * Create a new ticket from the user's request.
     * Validates attachment count, saves the ticket, and notifies admins/technicians.
     */
    public TicketDTO createTicket(CreateTicketRequest request) {
        log.info("Creating ticket: reporterId={}, category={}", request.getReporterId(), request.getCategory());

        if (request.getAttachments() != null && request.getAttachments().size() > 3) {
            throw new ValidationException("Maximum 3 attachments allowed per ticket.");
        }

        Ticket ticket = Ticket.builder()
                .reporterId(request.getReporterId())
                .resourceId(request.getResourceId())
                .category(request.getCategory())
                .description(request.getDescription())
                .preferredContactDetails(request.getPreferredContactDetails())
                .priority(request.getPriority())
                .status(TicketStatus.OPEN)
                .attachments(request.getAttachments() != null ? request.getAttachments() : new ArrayList<>())
                .build();

        Ticket saved = ticketRepository.save(ticket);
        notifyAdminsAndTechnicians(
                "🆕 New ticket submitted: " + saved.getCategory() + " (priority: " + saved.getPriority() + ")"
        );
        log.info("Ticket created: id={}", saved.getId());
        return mapToDTO(saved);
    }

    /**
     * Update an existing ticket.
     * Only the original reporter can update the ticket, and only if it is OPEN and unassigned.
     */
    public TicketDTO updateTicket(String id, CreateTicketRequest request, String requestUserId) {
        log.info("Updating ticket id={} by user={}", id, requestUserId);
        Ticket ticket = fetchTicket(id);

        if (!ticket.getReporterId().equals(requestUserId)) {
            throw new ValidationException("You can only update your own tickets.");
        }
        if (ticket.getStatus() != TicketStatus.OPEN || ticket.getAssignedTo() != null) {
            throw new ValidationException("You can only update tickets that are OPEN and not yet assigned.");
        }

        if (request.getAttachments() != null && request.getAttachments().size() > 3) {
            throw new ValidationException("Maximum 3 attachments allowed per ticket.");
        }

        ticket.setResourceId(request.getResourceId());
        ticket.setCategory(request.getCategory());
        ticket.setDescription(request.getDescription());
        ticket.setPreferredContactDetails(request.getPreferredContactDetails());
        ticket.setPriority(request.getPriority());
        if (request.getAttachments() != null) {
            ticket.setAttachments(request.getAttachments());
        }

        Ticket saved = ticketRepository.save(ticket);
        log.info("Ticket updated: id={}", saved.getId());
        return mapToDTO(saved);
    }

    /**
     * Fetch all tickets, ordered newest first. Used by admin dashboards.
     */
    public List<TicketDTO> getAllTickets() {
        return ticketRepository.findAllByOrderByCreatedAtDesc()
                .stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    /**
     * Fetch all tickets for a specific user, ordered newest first.
     */
    public List<TicketDTO> getUserTickets(String userId) {
        return ticketRepository.findByReporterIdOrderByCreatedAtDesc(userId)
                .stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    /**
     * Return a single ticket by its id.
     */
    public TicketDTO getTicket(String id) {
        return mapToDTO(fetchTicket(id));
    }

    /**
     * Assign a ticket to a technician/admin and move it into IN_PROGRESS if it was open.
     */
    public TicketDTO assignTicket(String id, String assigneeUserId) {
        log.info("Assigning ticket id={} to assigneeId={}", id, assigneeUserId);
        Ticket ticket = fetchTicket(id);
        User assignee = userRepository.findById(assigneeUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Assignee user not found with id: " + assigneeUserId));

        ticket.setAssignedTo(assignee.getId());
        if (ticket.getStatus() == TicketStatus.OPEN) {
            ticket.setStatus(TicketStatus.IN_PROGRESS);
        }
        Ticket updated = ticketRepository.save(ticket);

        // Only notify the assigned technician — NOT the reporter.
        // Reporter will be notified when status changes (resolved/rejected).
        notificationService.createNotification(
                assignee.getId(),
                "🛠️ A ticket has been assigned to you: [" + updated.getCategory() + "] #" + shortTicketId(updated.getId()) + ". Open to view full details.",
                NotificationType.TICKET_STATUS_CHANGED,
                "TICKET",
                updated.getId()
        );
        return mapToDTO(updated);
    }

    /**
     * Advance the ticket workflow status with validation.
     * Supports rejection reasons and notifies the reporter on status changes.
     */
    public TicketDTO updateStatus(String id, TicketStatus newStatus, String reason, String requestUserId, String requestUserRole) {
        log.info("Updating ticket id={} to status={}", id, newStatus);
        Ticket ticket = fetchTicket(id);
        enforceTechnicianAccess(ticket, requestUserId, requestUserRole);
        TicketStatus current = ticket.getStatus();

        // Validate transition
        Set<TicketStatus> allowed = VALID_TRANSITIONS.getOrDefault(current, Set.of());
        if (!allowed.contains(newStatus)) {
            throw new ValidationException(
                "Cannot transition ticket from " + current + " to " + newStatus +
                ". Allowed: " + allowed
            );
        }

        if (newStatus == TicketStatus.REJECTED && (reason == null || reason.trim().isEmpty())) {
            throw new ValidationException("Rejection reason is required when rejecting a ticket.");
        }
        if (newStatus == TicketStatus.REJECTED) {
            ticket.setRejectionReason(reason);
        }

        ticket.setStatus(newStatus);
        Ticket updated = ticketRepository.save(ticket);

        String emoji = switch (newStatus) {
            case RESOLVED -> "✅";
            case CLOSED   -> "🔒";
            case REJECTED -> "❌";
            default       -> "📋";
        };
        notificationService.createNotification(
                updated.getReporterId(),
                emoji + " Your ticket status has been updated to: " + newStatus
                        + (reason != null && !reason.isBlank() ? ". Reason: " + reason : ""),
                NotificationType.TICKET_STATUS_CHANGED,
                "TICKET",
                updated.getId()
        );
        return mapToDTO(updated);
    }

    /**
     * Add a new comment to a ticket and notify the reporter/assignee if needed.
     */
    public TicketDTO addComment(String id, String authorId, String content) {
        if (content == null || content.isBlank()) {
            throw new ValidationException("Comment content cannot be empty.");
        }
        Ticket ticket = fetchTicket(id);

        TicketComment comment = TicketComment.builder()
                .id(UUID.randomUUID().toString())
                .authorId(authorId)
                .content(content.trim())
                .createdAt(LocalDateTime.now())
                .build();

        ticket.getComments().add(comment);
        Ticket updated = ticketRepository.save(ticket);

        if (!updated.getReporterId().equals(authorId)) {
            notificationService.createNotification(
                    updated.getReporterId(),
                    "💬 A new comment was added to your ticket #" + updated.getId().substring(0, 8),
                    NotificationType.NEW_COMMENT,
                    "TICKET",
                    updated.getId()
            );
        }
        if (updated.getAssignedTo() != null && !updated.getAssignedTo().equals(authorId)) {
            notificationService.createNotification(
                    updated.getAssignedTo(),
                    "💬 A new comment was added on assigned ticket #" + shortTicketId(updated.getId()),
                    NotificationType.NEW_COMMENT,
                    "TICKET",
                    updated.getId()
            );
        }
        return mapToDTO(updated);
    }

    /**
     * Delete a comment from a ticket when the user is comment owner or an admin/technician.
     */
    public TicketDTO deleteComment(String id, String commentId, String requestUserId, String userRole) {
        Ticket ticket = fetchTicket(id);

        TicketComment target = ticket.getComments().stream()
                .filter(c -> c.getId().equals(commentId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        boolean isAdminOrTech = "ADMIN".equalsIgnoreCase(userRole) || "TECHNICIAN".equalsIgnoreCase(userRole);
        if (!target.getAuthorId().equals(requestUserId) && !isAdminOrTech) {
            throw new ValidationException("You can only delete your own comments.");
        }

        ticket.getComments().remove(target);
        return mapToDTO(ticketRepository.save(ticket));
    }

    /**
     * Delete a ticket after checking role and workflow state.
     * Admin can delete resolved/rejected tickets; users can delete their own resolved/rejected tickets.
     */
    public void deleteTicket(String id, String requestUserId, String requestUserRole) {
        Ticket ticket = fetchTicket(id);
        boolean isAdmin = "ADMIN".equalsIgnoreCase(requestUserRole);
        boolean isReporter = requestUserId.equals(ticket.getReporterId());

        boolean isResolvedOrRejected = ticket.getStatus() == TicketStatus.RESOLVED
                || ticket.getStatus() == TicketStatus.REJECTED
                || ticket.getStatus() == TicketStatus.CLOSED;

        if (isAdmin) {
            if (!isResolvedOrRejected) {
                throw new ValidationException("Tickets can only be deleted after they are RESOLVED or REJECTED.");
            }
            ticketRepository.delete(ticket);
            return;
        }

        if (!isReporter) {
            throw new ValidationException("You can only delete your own tickets.");
        }
        if (!isResolvedOrRejected) {
            throw new ValidationException("You can only delete your tickets after they are RESOLVED or REJECTED.");
        }
        ticketRepository.delete(ticket);
    }

    /**
     * Edit a ticket comment. Only the original author may update the comment.
     */
    public TicketDTO editComment(String ticketId, String commentId, String requestUserId, String newContent) {
        if (newContent == null || newContent.isBlank()) {
            throw new ValidationException("Comment content cannot be empty.");
        }
        Ticket ticket = fetchTicket(ticketId);

        TicketComment target = ticket.getComments().stream()
                .filter(c -> c.getId().equals(commentId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        if (!target.getAuthorId().equals(requestUserId)) {
            throw new ValidationException("You can only edit your own comments.");
        }
        target.setContent(newContent.trim());
        return mapToDTO(ticketRepository.save(ticket));
    }

    /**
     * Add an attachment path to a ticket record.
     * Only the ticket reporter can add attachments, and only up to 3 total.
     */
    public TicketDTO addAttachment(String id, String attachmentUrl, String requestUserId) {
        Ticket ticket = fetchTicket(id);
        if (!ticket.getReporterId().equals(requestUserId)) {
            throw new ValidationException("Only the ticket reporter can add attachments.");
        }
        if (ticket.getAttachments().size() >= 3) {
            throw new ValidationException("Maximum 3 attachments allowed per ticket.");
        }
        ticket.getAttachments().add(attachmentUrl);
        return mapToDTO(ticketRepository.save(ticket));
    }

    /**
     * Mark a ticket as resolved, store optional notes, and notify the reporter.
     */
    public TicketDTO resolveWithNotes(String id, String notes, String requestUserId, String requestUserRole) {
        Ticket ticket = fetchTicket(id);
        enforceTechnicianAccess(ticket, requestUserId, requestUserRole);
        ticket.setStatus(TicketStatus.RESOLVED);
        ticket.setResolvedBy(requestUserId);
        if (notes != null && !notes.isBlank()) {
            ticket.setResolutionNotes(notes.trim());
        }
        Ticket updated = ticketRepository.save(ticket);
        notificationService.createNotification(
                updated.getReporterId(),
                "✅ Your ticket has been RESOLVED. Notes: " + (notes != null ? notes : "No notes provided."),
                NotificationType.TICKET_STATUS_CHANGED,
                "TICKET",
                updated.getId()
        );
        return mapToDTO(updated);
    }

    /**
     * Load a ticket by id, throwing a not found exception if it does not exist.
     */
    protected Ticket fetchTicket(String id) {
        return ticketRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found with id: " + id));
    }

    /**
     * Resolve a resource id into a display name when possible.
     */
    private String enrichResourceName(String resourceId) {
        if (resourceId == null) return null;
        try { return resourceService.fetchResource(resourceId).getName(); }
        catch (Exception e) { return resourceId; }
    }

    /**
     * Send a notification message to all admin and technician users.
     */
    private void notifyAdminsAndTechnicians(String message) {
        List<User> staff = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.ADMIN || u.getRole() == Role.TECHNICIAN)
                .collect(Collectors.toList());
        for (User user : staff) {
            notificationService.createNotification(user.getId(), message, NotificationType.TICKET_STATUS_CHANGED);
        }
    }

    /**
     * Notify other technicians that a ticket has been assigned.
     */
    private void notifyTechniciansAboutAssignment(String ticketId, String assignedUserId) {
        List<User> technicians = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.TECHNICIAN)
                .filter(u -> !u.getId().equals(assignedUserId))
                .collect(Collectors.toList());

        for (User technician : technicians) {
            notificationService.createNotification(
                    technician.getId(),
                    "🛠️ Ticket #" + shortTicketId(ticketId) + " was assigned by admin. Open to view details.",
                    NotificationType.TICKET_STATUS_CHANGED,
                    "TICKET",
                    ticketId
            );
        }
    }

    /**
     * Create a short 8-character version of the ticket id for display.
     */
    private String shortTicketId(String id) {
        if (id == null) return "unknown";
        return id.length() <= 8 ? id : id.substring(0, 8);
    }

    /**
     * Prevent technicians from acting on tickets not assigned to them.
     */
    private void enforceTechnicianAccess(Ticket ticket, String requestUserId, String requestUserRole) {
        if (!"TECHNICIAN".equalsIgnoreCase(requestUserRole)) {
            return;
        }
        if (ticket.getAssignedTo() == null || !ticket.getAssignedTo().equals(requestUserId)) {
            throw new ValidationException("Technicians can only update tickets assigned to themselves.");
        }
    }

    /**
     * Convert a Ticket entity into a TicketDTO for REST responses.
     */
    private TicketDTO mapToDTO(Ticket ticket) {
        TicketDTO dto = new TicketDTO();
        dto.setId(ticket.getId());
        dto.setResourceId(ticket.getResourceId());
        dto.setResourceName(enrichResourceName(ticket.getResourceId()));
        dto.setReporterId(ticket.getReporterId());
        dto.setCategory(ticket.getCategory());
        dto.setDescription(ticket.getDescription());
        dto.setPreferredContactDetails(ticket.getPreferredContactDetails());
        dto.setPriority(ticket.getPriority());
        dto.setStatus(ticket.getStatus());
        dto.setAssignedTo(ticket.getAssignedTo());
        dto.setComments(ticket.getComments());
        dto.setAttachments(ticket.getAttachments());
        dto.setRejectionReason(ticket.getRejectionReason());
        dto.setResolutionNotes(ticket.getResolutionNotes());
        dto.setResolvedBy(ticket.getResolvedBy());
        dto.setCreatedAt(ticket.getCreatedAt());
        dto.setUpdatedAt(ticket.getUpdatedAt());
        return dto;
    }
}
