package com.campus.backend.controller;

import com.campus.backend.dto.CreateResourceRequest;
import com.campus.backend.dto.PageResponse;
import com.campus.backend.dto.ResourceDTO;
import com.campus.backend.dto.UpdateResourceRequest;
import com.campus.backend.exception.UnauthorizedException;
import com.campus.backend.model.ResourceStatus;
import com.campus.backend.model.ResourceType;
import com.campus.backend.service.ResourceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;


@Slf4j
@RestController
@RequestMapping("/api/resources")
@RequiredArgsConstructor
public class ResourceController {

    private final ResourceService resourceService;

    // ── CREATE ────────────────────────────────────────────────────────────────

    /**
     * Creates a new resource. ADMIN only.
     *
     * <pre>POST /api/resources</pre>
     */
    @PostMapping
    public ResponseEntity<ResourceDTO> createResource(
            @Valid @RequestBody CreateResourceRequest request,
            @RequestAttribute("userRole") String userRole) {

        requireAdmin(userRole, "create resources");
        ResourceDTO created = resourceService.createResource(request);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    // ── READ (all, with optional filters) ─────────────────────────────────────

    /**
     * Returns all resources matching the optional filter criteria.
     * All filter parameters may be combined simultaneously.
     *
     * <pre>GET /api/resources?type=LAB&amp;minCapacity=20&amp;location=Building+3&amp;status=ACTIVE</pre>
     */
    @GetMapping
    public ResponseEntity<List<ResourceDTO>> getAllResources(
            @RequestParam(required = false) ResourceType type,
            @RequestParam(required = false) Integer minCapacity,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) ResourceStatus status) {

        return ResponseEntity.ok(
                resourceService.getAllResources(type, minCapacity, location, status));
    }

    /**
     * Returns a paginated view of resources with optional filters.
     *
     * <pre>GET /api/resources/page?type=LAB&amp;page=0&amp;size=10&amp;sortBy=name&amp;sortDir=asc</pre>
     */
    @GetMapping("/page")
    public ResponseEntity<PageResponse<ResourceDTO>> getResourcesPage(
            @RequestParam(required = false) ResourceType type,
            @RequestParam(required = false) Integer minCapacity,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) ResourceStatus status,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc")  String sortDir) {

        return ResponseEntity.ok(
                resourceService.getResourcesPage(
                        type, minCapacity, location, status,
                        page, size, sortBy, sortDir));
    }

    // ── READ (single) ─────────────────────────────────────────────────────────

    /**
     * Returns a single resource by its MongoDB id.
     *
     * <pre>GET /api/resources/{id}</pre>
     */
    @GetMapping("/{id}")
    public ResponseEntity<ResourceDTO> getResource(@PathVariable String id) {
        return ResponseEntity.ok(resourceService.getResource(id));
    }

    // ── UPDATE ────────────────────────────────────────────────────────────────

    /**
     * Partially updates a resource (patch semantics). ADMIN only.
     * Only fields present in the request body are updated.
     *
     * <pre>PUT /api/resources/{id}</pre>
     */
    @PutMapping("/{id}")
    public ResponseEntity<ResourceDTO> updateResource(
            @PathVariable String id,
            @Valid @RequestBody UpdateResourceRequest request,
            @RequestAttribute("userRole") String userRole) {

        requireAdmin(userRole, "update resources");
        return ResponseEntity.ok(resourceService.updateResource(id, request));
    }

    /**
     * Quick-toggle the operational status of a resource. ADMIN only.
     *
     * <pre>PATCH /api/resources/{id}/status?value=OUT_OF_SERVICE</pre>
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<ResourceDTO> setResourceStatus(
            @PathVariable String id,
            @RequestParam ResourceStatus value,
            @RequestAttribute("userRole") String userRole) {

        requireAdmin(userRole, "change resource status");
        return ResponseEntity.ok(resourceService.setStatus(id, value));
    }

    // ── DELETE ────────────────────────────────────────────────────────────────

    /**
     * Permanently deletes a resource. ADMIN only.
     *
     * <pre>DELETE /api/resources/{id}</pre>
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteResource(
            @PathVariable String id,
            @RequestAttribute("userRole") String userRole) {

        requireAdmin(userRole, "delete resources");
        resourceService.deleteResource(id);
        return ResponseEntity.noContent().build();
    }

    // ── PRIVATE HELPERS ───────────────────────────────────────────────────────

    /**
     * Belt-and-suspenders ADMIN role check.
     * The {@code AuthInterceptor} is the first line of defence;
     * this is the second, at the controller level.
     */
    private void requireAdmin(String role, String action) {
        if (!"ADMIN".equalsIgnoreCase(role)) {
            throw new UnauthorizedException(
                    "Access denied: only ADMIN users can " + action + ".");
        }
    }
}
