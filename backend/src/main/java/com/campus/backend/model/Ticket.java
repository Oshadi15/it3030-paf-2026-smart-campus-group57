package com.campus.backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "tickets")
public class Ticket {
    @Id
    private String id;
    private String resourceId;
    private String reporterId; // who raised it
    private String category;
    private String description;
    private String preferredContactDetails;
    private TicketPriority priority;
    private TicketStatus status;
    private String assignedTo; // admin/tech id
    
    @Builder.Default
    private List<TicketComment> comments = new ArrayList<>();
    
    @Builder.Default
    private List<String> attachments = new ArrayList<>(); // URLs/paths, max 3
    
    private String rejectionReason;

    /** Notes added by admin/technician when resolving the ticket. */
    private String resolutionNotes;
    /** User id of admin/technician who marked this ticket as resolved. */
    private String resolvedBy;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
