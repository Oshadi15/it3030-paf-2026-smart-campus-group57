package com.campus.backend.service;

import com.campus.backend.dto.NotificationDTO;
import com.campus.backend.exception.ResourceNotFoundException;
import com.campus.backend.exception.UnauthorizedException;
import com.campus.backend.model.Notification;
import com.campus.backend.model.NotificationType;
import com.campus.backend.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;

    /**
     * Internal method — called by Booking/Ticket services to create notifications.
     */
    public void createNotification(String userId, String message, NotificationType type) {
        createNotification(userId, message, type, null, null);
    }

    public void createNotification(String userId, String message, NotificationType type, String referenceType, String referenceId) {
        log.debug("Creating notification for userId={}, type={}", userId, type);
        Notification notification = Notification.builder()
                .userId(userId)
                .message(message)
                .type(type)
                .referenceType(referenceType)
                .referenceId(referenceId)
                .readStatus(false)
                .build();
        notificationRepository.save(notification);
    }

    public List<NotificationDTO> getUserNotifications(String userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public long getUnreadCount(String userId) {
        return notificationRepository.countByUserIdAndReadStatus(userId, false);
    }

    public NotificationDTO markAsRead(String id, String requestUserId, String requestUserRole) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found with id: " + id));
        enforceOwnerOrAdmin(notification, requestUserId, requestUserRole);
        notification.setReadStatus(true);
        return mapToDTO(notificationRepository.save(notification));
    }

    /** Mark all notifications for a user as read. */
    public int markAllAsRead(String userId) {
        List<Notification> unread = notificationRepository.findByUserIdAndReadStatus(userId, false);
        unread.forEach(n -> n.setReadStatus(true));
        notificationRepository.saveAll(unread);
        log.info("Marked {} notifications as read for userId={}", unread.size(), userId);
        return unread.size();
    }

    /** Delete a single notification. Only the owner can delete. */
    public void deleteNotification(String id, String requestUserId, String requestUserRole) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found with id: " + id));
        enforceOwnerOrAdmin(notification, requestUserId, requestUserRole);
        notificationRepository.delete(notification);
    }

    /** Delete all notifications for a user (clear all). */
    @Transactional
    public void clearAll(String userId) {
        notificationRepository.deleteByUserId(userId);
        log.info("Cleared all notifications for userId={}", userId);
    }

    private NotificationDTO mapToDTO(Notification notification) {
        NotificationDTO dto = new NotificationDTO();
        dto.setId(notification.getId());
        dto.setUserId(notification.getUserId());
        dto.setMessage(notification.getMessage());
        dto.setType(notification.getType());
        dto.setReferenceType(notification.getReferenceType());
        dto.setReferenceId(notification.getReferenceId());
        dto.setReadStatus(notification.getReadStatus());
        dto.setCreatedAt(notification.getCreatedAt());
        return dto;
    }

    private void enforceOwnerOrAdmin(Notification notification, String requestUserId, String requestUserRole) {
        if (requestUserRole != null && "ADMIN".equalsIgnoreCase(requestUserRole)) {
            return;
        }
        if (!notification.getUserId().equals(requestUserId)) {
            throw new UnauthorizedException("You can only access your own notifications.");
        }
    }
}
