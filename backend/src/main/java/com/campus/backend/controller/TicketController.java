package com.campus.backend.controller;

import com.campus.backend.dto.CreateTicketRequest;
import com.campus.backend.dto.TicketCommentRequest;
import com.campus.backend.dto.TicketDTO;
import com.campus.backend.exception.UnauthorizedException;
import com.campus.backend.exception.ValidationException;
import com.campus.backend.model.TicketStatus;
import com.campus.backend.service.TicketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;


@Slf4j
@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
public class TicketController {

    private final TicketService ticketService;

    // Upload directory inside the running directory
    private static final String UPLOAD_DIR = "uploads/tickets/";

    /**
     * Ticket API Endpoints (Role Summary)
     *
     * <pre>
     * POST   /api/tickets                     — USER (creates own) / ADMIN
     * PUT    /api/tickets/{id}                — USER (own) / ADMIN
     *
     * GET    /api/tickets                     — ADMIN / TECHNICIAN (all tickets)
     * GET    /api/tickets/{id}                — USER (own) / ADMIN / TECHNICIAN
     * GET    /api/tickets/user/{userId}       — USER (own) / ADMIN / TECHNICIAN
     *
     * PUT    /api/tickets/{id}/assign         — ADMIN only (assign to TECHNICIAN)
     * PUT    /api/tickets/{id}/status         — ADMIN / TECHNICIAN
     * PUT    /api/tickets/{id}/resolve        — ADMIN / TECHNICIAN
     *
     * POST   /api/tickets/{id}/comments       — any authenticated user
     * PUT    /api/tickets/{id}/comments/{cId} — comment owner only
     * DELETE /api/tickets/{id}/comments/{cId} — comment owner / ADMIN / TECHNICIAN
     *
     * DELETE /api/tickets/{id}                — USER (own previous: RESOLVED/CLOSED/REJECTED) / ADMIN
     * POST   /api/tickets/{id}/delete         — same as DELETE (fallback for clients blocking DELETE)
     *
     * POST   /api/tickets/{id}/attachments    — ticket reporter only (multipart image upload, max 3)
     * </pre>
     */
    /**
     * Create a new ticket from the authenticated user.
     * The reporterId is forced to the authenticated user id.
     */
    @PostMapping
    public ResponseEntity<TicketDTO> createTicket(
            @Valid @RequestBody CreateTicketRequest request,
            @RequestHeader("X-User-Id") String requestUserId) {
        // Force the reporterId to match the authenticated user
        request.setReporterId(requestUserId);
        TicketDTO created = ticketService.createTicket(request);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    /**
     * Update an existing ticket.
     * The reporterId is verified in the service layer.
     */
    @PutMapping("/{id}")
    public ResponseEntity<TicketDTO> updateTicket(
            @PathVariable String id,
            @Valid @RequestBody CreateTicketRequest request,
            @RequestHeader("X-User-Id") String requestUserId) {
        request.setReporterId(requestUserId);
        TicketDTO updated = ticketService.updateTicket(id, request, requestUserId);
        return ResponseEntity.ok(updated);
    }

    /**
     * Return all tickets for admin and technicians.
     */
    @GetMapping
    public ResponseEntity<List<TicketDTO>> getAllTickets(
            @RequestHeader(value = "X-User-Role", defaultValue = "USER") String userRole) {
        if (!"ADMIN".equalsIgnoreCase(userRole) && !"TECHNICIAN".equalsIgnoreCase(userRole)) {
            throw new UnauthorizedException("Only ADMIN or TECHNICIAN can view all tickets.");
        }
        return ResponseEntity.ok(ticketService.getAllTickets());
    }

    /**
     * Return one ticket by id. Users may only view their own tickets, admins and technicians can view any.
     */
    @GetMapping("/{id}")
    public ResponseEntity<TicketDTO> getTicket(
            @PathVariable String id,
            @RequestHeader("X-User-Id") String requestUserId,
            @RequestHeader(value = "X-User-Role", defaultValue = "USER") String userRole) {
        TicketDTO ticket = ticketService.getTicket(id);
        boolean isAdminOrTech = "ADMIN".equalsIgnoreCase(userRole) || "TECHNICIAN".equalsIgnoreCase(userRole);
        // Only allow regular users to view their own tickets; admins and technicians can view any.
        if (!isAdminOrTech && !requestUserId.equals(ticket.getReporterId())) {
            throw new UnauthorizedException("You may only view your own tickets.");
        }
        return ResponseEntity.ok(ticket);
    }

    /**
     * Return tickets for one user. Non-admin users may only fetch their own tickets.
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<TicketDTO>> getUserTickets(
            @PathVariable String userId,
            @RequestHeader("X-User-Id") String requestUserId,
            @RequestHeader(value = "X-User-Role", defaultValue = "USER") String userRole) {

        // Regular users may only fetch their own ticket list; admins and technicians can fetch by any user id.
        if (!"ADMIN".equalsIgnoreCase(userRole) && !"TECHNICIAN".equalsIgnoreCase(userRole) && !userId.equals(requestUserId)) {
            throw new UnauthorizedException("You may only view your own tickets.");
        }
        return ResponseEntity.ok(ticketService.getUserTickets(userId));
    }

    /**
     * Assign a ticket to a technician or admin user.
     * Only ADMIN role may perform this action.
     */
    @PutMapping("/{id}/assign")
    public ResponseEntity<TicketDTO> assignTicket(
            @PathVariable String id,
            @RequestParam String adminId,
            @RequestHeader(value = "X-User-Role", defaultValue = "USER") String userRole) {

        if (!"ADMIN".equalsIgnoreCase(userRole)) {
            throw new UnauthorizedException("Only ADMIN can assign tickets.");
        }
        return ResponseEntity.ok(ticketService.assignTicket(id, adminId));
    }

    /**
     * Advance ticket workflow status.  admin roles can use this endpoint.
     */
    @PutMapping("/{id}/status")
    public ResponseEntity<TicketDTO> updateStatus(
            @PathVariable String id,
            @RequestParam TicketStatus status,
            @RequestParam(required = false) String reason,
            @RequestHeader("X-User-Id") String requestUserId,
            @RequestHeader(value = "X-User-Role", defaultValue = "USER") String userRole) {

        if (!"ADMIN".equalsIgnoreCase(userRole) && !"TECHNICIAN".equalsIgnoreCase(userRole)) {
            throw new UnauthorizedException("Only ADMIN or TECHNICIAN can update ticket status.");
        }
        return ResponseEntity.ok(ticketService.updateStatus(id, status, reason, requestUserId, userRole));
    }

    /**
     * Mark a ticket resolved and optionally save resolution notes.
     * Both ADMIN and TECHNICIAN may perform this.
     */
    @PutMapping("/{id}/resolve")
    public ResponseEntity<TicketDTO> resolveTicket(
            @PathVariable String id,
            @RequestParam(required = false) String notes,
            @RequestHeader("X-User-Id") String requestUserId,
            @RequestHeader(value = "X-User-Role", defaultValue = "USER") String userRole) {

        if (!"ADMIN".equalsIgnoreCase(userRole) && !"TECHNICIAN".equalsIgnoreCase(userRole)) {
            throw new UnauthorizedException("Only ADMIN or TECHNICIAN can resolve tickets.");
        }
        return ResponseEntity.ok(ticketService.resolveWithNotes(id, notes, requestUserId, userRole));
    }

    /**
     * Add a comment to a ticket. Any authenticated user may comment.
     */
    @PostMapping("/{id}/comments")
    public ResponseEntity<TicketDTO> addComment(
            @PathVariable String id,
            @Valid @RequestBody TicketCommentRequest commentRequest,
            @RequestHeader("X-User-Id") String requestUserId) {
        return ResponseEntity.ok(ticketService.addComment(id, requestUserId, commentRequest.getContent()));
    }

    /**
     * Edit an existing ticket comment. Only the original author may edit.
     */
    @PutMapping("/{id}/comments/{commentId}")
    public ResponseEntity<TicketDTO> editComment(
            @PathVariable String id,
            @PathVariable String commentId,
            @Valid @RequestBody TicketCommentRequest commentRequest,
            @RequestHeader("X-User-Id") String requestUserId) {
        return ResponseEntity.ok(ticketService.editComment(id, commentId, requestUserId, commentRequest.getContent()));
    }

    /**
     * Delete a comment from a ticket. Owners and admins/technicians may delete.
     */
    @DeleteMapping("/{id}/comments/{commentId}")
    public ResponseEntity<TicketDTO> deleteComment(
            @PathVariable String id,
            @PathVariable String commentId,
            @RequestHeader("X-User-Id") String requestUserId,
            @RequestHeader(value = "X-User-Role", defaultValue = "USER") String userRole) {
        return ResponseEntity.ok(ticketService.deleteComment(id, commentId, requestUserId, userRole));
    }

    /**
     * Delete a ticket. Users may delete their own resolved/rejected tickets; admins may delete any resolved/rejected ticket.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTicket(
            @PathVariable String id,
            @RequestHeader("X-User-Id") String requestUserId,
            @RequestHeader(value = "X-User-Role", defaultValue = "USER") String userRole) {
        ticketService.deleteTicket(id, requestUserId, userRole);
        return ResponseEntity.noContent().build();
    }

    /**
     * Fallback delete endpoint for environments where DELETE is blocked.
     */
    @PostMapping("/{id}/delete")
    public ResponseEntity<Void> deleteTicketViaPost(
            @PathVariable String id,
            @RequestHeader("X-User-Id") String requestUserId,
            @RequestHeader(value = "X-User-Role", defaultValue = "USER") String userRole) {
        ticketService.deleteTicket(id, requestUserId, userRole);
        return ResponseEntity.noContent().build();
    }

    /**
     * Upload an image attachment for a ticket.
     * Reporter only. Max 3 attachments per ticket.
     * Accepts multipart file; saves to disk and stores the path.
     */
    @PostMapping("/{id}/attachments")
    public ResponseEntity<TicketDTO> uploadAttachment(
            @PathVariable String id,
            @RequestParam("file") MultipartFile file,
            @RequestHeader("X-User-Id") String requestUserId) throws IOException {

        if (file.isEmpty()) {
            throw new ValidationException("File must not be empty.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new ValidationException("Only image files (jpg, png, gif, webp) are allowed.");
        }
        if (file.getSize() > 5 * 1024 * 1024) { // 5 MB limit
            throw new ValidationException("File size must not exceed 5 MB.");
        }

        // Save file
        Path uploadPath = Paths.get(UPLOAD_DIR);
        Files.createDirectories(uploadPath);
        String originalFilename = file.getOriginalFilename() != null
                ? Paths.get(file.getOriginalFilename()).getFileName().toString()
                : "attachment";
        String filename = UUID.randomUUID() + "_" + originalFilename;
        Path filePath = uploadPath.resolve(filename);
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

        String relativeUrl = "/uploads/tickets/" + filename;
        log.info("Saved attachment for ticket {} to {}", id, relativeUrl);

        return ResponseEntity.ok(ticketService.addAttachment(id, relativeUrl, requestUserId));
    }
}
