package com.campus.backend.controller;

import com.campus.backend.exception.UnauthorizedException;
import com.campus.backend.exception.ValidationException;
import com.campus.backend.model.*;
import com.campus.backend.repository.*;
import com.campus.backend.dto.CreateUserRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import java.util.Map;

/**
 * Dashboard statistics endpoint for the Admin Dashboard UI.
 * Returns aggregate counts for bookings, tickets, resources, and users.
 *
 * <pre>GET /api/admin/stats</pre>
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final BookingRepository  bookingRepository;
    private final TicketRepository   ticketRepository;
    private final ResourceRepository resourceRepository;
    private final UserRepository     userRepository;

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getDashboardStats(
            @RequestAttribute("userRole") String userRole) {
        requireAdmin(userRole);

        Map<String, Object> stats = Map.of(
            "totalResources",        resourceRepository.count(),
            "totalUsers",            userRepository.count(),
            "bookings", Map.of(
                "pending",   bookingRepository.countByStatus(BookingStatus.PENDING),
                "approved",  bookingRepository.countByStatus(BookingStatus.APPROVED),
                "rejected",  bookingRepository.countByStatus(BookingStatus.REJECTED),
                "cancelled", bookingRepository.countByStatus(BookingStatus.CANCELLED),
                "total",     bookingRepository.count()
            ),
            "tickets", Map.of(
                "open",        ticketRepository.countByStatus(TicketStatus.OPEN),
                "inProgress",  ticketRepository.countByStatus(TicketStatus.IN_PROGRESS),
                "resolved",    ticketRepository.countByStatus(TicketStatus.RESOLVED),
                "closed",      ticketRepository.countByStatus(TicketStatus.CLOSED),
                "rejected",    ticketRepository.countByStatus(TicketStatus.REJECTED),
                "total",       ticketRepository.count()
            )
        );

        return ResponseEntity.ok(stats);
    }

    @GetMapping("/users")
    public ResponseEntity<List<User>> getAllUsers(@RequestAttribute("userRole") String userRole) {
        requireAdmin(userRole);
        return ResponseEntity.ok(userRepository.findAll());
    }

    @PostMapping("/users")
    public ResponseEntity<User> createUser(
            @RequestAttribute("userRole") String userRole,
            @Valid @RequestBody CreateUserRequest request) {
        requireAdmin(userRole);

        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new com.campus.backend.exception.ValidationException("Email already registered: " + request.getEmail());
        }

        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .role(parseRoleOrThrow(request.getRole()))
                .build();
        return ResponseEntity.ok(userRepository.save(user));
    }

    @PutMapping("/users/{id}/role")
    public ResponseEntity<User> updateUserRole(
            @RequestAttribute("userRole") String userRole,
            @PathVariable String id,
            @RequestParam String role) {
        requireAdmin(userRole);

        User user = userRepository.findById(id)
                .orElseThrow(() -> new com.campus.backend.exception.ResourceNotFoundException("User not found"));
        user.setRole(parseRoleOrThrow(role));
        return ResponseEntity.ok(userRepository.save(user));
    }
    //commented out delete user endpoint to prevent accidental deletion of users
    private void requireAdmin(String userRole) {
        if (!"ADMIN".equals(userRole)) {
            throw new UnauthorizedException("Only ADMIN can access users.");
        }
    }

    private Role parseRoleOrThrow(String role) {
        try {
            return Role.valueOf(role.toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ValidationException("Invalid role: " + role + ". Allowed roles: USER, ADMIN, TECHNICIAN");
        }
    }
}
