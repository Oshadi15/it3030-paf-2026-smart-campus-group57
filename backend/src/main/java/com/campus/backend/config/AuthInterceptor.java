package com.campus.backend.config;

import com.campus.backend.exception.UnauthorizedException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Validates that every protected API request carries X-User-Id and X-User-Role headers.
 * These are set by the frontend after a successful Google OAuth login.
 *
 * <p>Additionally enforces coarse-grained role restrictions at the interceptor level.
 * Fine-grained per-endpoint checks are done inside each controller.
 */
@Slf4j
@Component
public class AuthInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // Always allow pre-flight CORS requests through
        if ("OPTIONS".equals(request.getMethod())) return true;

        String userId   = request.getHeader("X-User-Id");
        String userRole = request.getHeader("X-User-Role");

        if (userId == null || userId.isBlank() || userRole == null || userRole.isBlank()) {
            log.warn("Rejected request to {} — missing auth headers", request.getRequestURI());
            throw new UnauthorizedException("Missing authentication headers. Please log in.");
        }

        // Normalise role to uppercase for consistent comparisons
        userRole = userRole.toUpperCase();

        request.setAttribute("userId",   userId);
        request.setAttribute("userRole", userRole);

        log.debug("Auth OK: userId={}, role={}, path={}", userId, userRole, request.getRequestURI());

        String path   = request.getRequestURI();
        String method = request.getMethod();

        // Coarse guard: writing to resources requires ADMIN
        if (path.startsWith("/api/resources") && !method.equals("GET")) {
            if (!"ADMIN".equals(userRole)) {
                throw new UnauthorizedException("Only ADMIN can modify resources.");
            }
        }

        // Coarse guard: workflow state transitions
        if (path.contains("/approve") || path.contains("/reject") ||
            path.contains("/assign")  || path.contains("/status") || path.contains("/resolve")) {
            if (path.startsWith("/api/tickets")) {
                if (path.contains("/assign")) {
                    if (!"ADMIN".equals(userRole)) {
                        throw new UnauthorizedException("Only ADMIN can assign tickets.");
                    }
                } else if (!"ADMIN".equals(userRole) && !"TECHNICIAN".equals(userRole)) {
                    throw new UnauthorizedException("Only ADMIN or TECHNICIAN can modify tickets.");
                }
            } else {
                if (!"ADMIN".equals(userRole)) {
                    throw new UnauthorizedException("Only ADMIN can perform this action.");
                }
            }
        }

        return true;
    }
}
