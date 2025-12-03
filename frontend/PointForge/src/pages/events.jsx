/**
 * Events Page Component
 *
 * This page displays a list of events with filtering, pagination, and management capabilities.
 * Key features:
 * - View all events with status, type, and advanced filters
 * - Search events by name
 * - Pagination to handle large lists
 * - For regular users: Add one-time events to wallet
 * - For managers: Create, edit, and delete events
 * - Click "View details" to open a popup modal with full event information
 */

import { useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserContext } from '../contexts/UserContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import {
    Loading,
    Error,
    EventEditorModal,
    EventDetailModal,
    ConfirmModal
} from '../components';
import { authenticatedFetch } from '../utils/api.js';
import { formatDate } from '../utils/dateUtils.js';
import './events.css';

// Number of events to show per page for pagination
const PAGE_SIZE = 12;

function Events() {
    // Get current user from context to determine permissions and default filters
    const { user } = useContext(UserContext);
    const { t } = useLanguage();
    const isManager = user?.role === 'manager' || user?.role === 'superuser';
    const isRegular = user?.role === 'regular';

    const [searchParams, setSearchParams] = useSearchParams();

    // Filter state - initialized from URL params
    // Regular users can't see unpublished events, so ignore published=false from URL
    const publishedFromUrl = searchParams.get('published');
    const initialPublished = isManager ? (publishedFromUrl || "") : "";
    const [filters, setFilters] = useState({
        name: searchParams.get('name') || '',
        location: searchParams.get('location') || '',
        started: searchParams.get('started') || "",
        ended: searchParams.get('ended') || "",
        full: searchParams.get('full') || "",
        published: initialPublished
    });

    // UI state management
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);  // Toggle advanced filter panel
    const [lastRole, setLastRole] = useState(user?.role);                   // Track role changes to reset filters
    const pageParam = searchParams.get('page');
    const [page, setPage] = useState(pageParam ? Math.max(1, parseInt(pageParam)) : 1);  // Current page number for pagination
    const [refreshKey, setRefreshKey] = useState(0);                        // Key to force re-fetch when events change
    const [data, setData] = useState({ results: [], count: 0 });            // Events data from API
    const [loading, setLoading] = useState(false);                          // Loading state for API calls
    const [error, setError] = useState('');                                  // Error message to display
    const [toast, setToast] = useState('');                                 // Success/notification message (for non-modal toasts)
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);        // Whether confirmation popup is open
    const [eventToApply, setEventToApply] = useState(null);         // Event ID to apply after confirmation

    // Modal state for creating/editing events (managers only)
    const [modalState, setModalState] = useState({ open: false, mode: 'create', event: null });
    const [modalBusy, setModalBusy] = useState(false);                       // Prevents double-submission
    const [modalError, setModalError] = useState('');                        // Error from create/edit operation

    // State for adding events to wallet (regular users)
    const [applyingId, setApplyingId] = useState(null);                     // ID of event being added (for loading state)

    // State for event detail popup modal
    const [detailModalOpen, setDetailModalOpen] = useState(false);         // Whether detail popup is open
    const [selectedEventId, setSelectedEventId] = useState(null);   // ID of event to show in popup

    // Auto-hide toast messages after 4 seconds
    // This useEffect runs whenever 'toast' changes and sets a timer to clear it
    useEffect(() => {
        if(!toast) {
            return;  // No toast to hide
        }
        const timer = setTimeout(() => setToast(''), 4000);  // Clear toast after 4 seconds
        return () => clearTimeout(timer);  // Cleanup: cancel timer if component unmounts or toast changes
    }, [toast]);

    // Update URL params when filters or page change (bookmarkable URLs)
    useEffect(() => {
        const params = new URLSearchParams();
        if (filters.name.trim()) params.set('name', filters.name.trim());
        if (filters.location.trim()) params.set('location', filters.location.trim());
        if (filters.started === "true" || filters.started === "false") params.set('started', filters.started);
        if (filters.ended === "true" || filters.ended === "false") params.set('ended', filters.ended);
        if (filters.full === "true" || filters.full === "false") params.set('full', filters.full);
        if (isManager && filters.published === "false") {
            params.set('published', filters.published);
        }
        if (page > 1) params.set('page', String(page));
        
        setSearchParams(params);
    }, [filters, page, isManager, setSearchParams]);

    // Reset status filter when user role changes
    // This ensures managers always see 'all' and regular users see 'active' when they log in
    useEffect(() => {
        if(!user?.role || user.role === lastRole) {
            return;  // No role change, do nothing
        }
        setFilters((prev) => ({
            ...prev,
            status: user.role === 'manager' || user.role === 'superuser' ? prev.published : true
        }));
        setLastRole(user.role);  // Remember the new role
    }, [user?.role, lastRole]);

    // Main effect: Fetch events from API whenever filters, page, or refreshKey changes
    // This is the core data fetching logic that runs whenever user changes filters or page
    useEffect(() => {
        const controller = new AbortController();  // Allows canceling the request if component unmounts

        const fetchEvents = async () => {
            setLoading(true);   // Show loading spinner
            setError('');       // Clear any previous errors
            try {
                // Build query parameters from filter state
                const params = new URLSearchParams();
                params.set('page', String(page));           // Current page number
                params.set('limit', String(PAGE_SIZE));     // How many per page

                // Add search filter if user typed something
                if(filters.name.trim()) {
                    params.set('name', filters.name.trim());
                }

                // Add location filter
                if(filters.location.trim()) {
                    params.set('location', filters.location.trim());
                }

                if(filters.started === "true" || filters.started === "false") {
                    params.set('started', filters.started);
                }

                if(filters.ended === "true" || filters.ended === "false") {
                    params.set('ended', filters.ended);
                }

                if(filters.full === "true" || filters.full === "false") {
                    params.set('full', filters.full);
                }

                if(filters.published === "false" && isManager) {
                    params.set('published', filters.published);
                } else {
                    params.set('published', "true");
                }

                // Make authenticated API request
                const response = await authenticatedFetch(`/events?${params.toString()}`, {
                    signal: controller.signal  // Allows cancellation
                });
                console.log("params: ", params.toString());

                // Handle expired session (authenticatedFetch handles logout automatically)
                if(response.status === 401) {
                    throw new Error('Session expired. Please log in again.');
                }

                // Check content type before parsing - prevents errors if server returns HTML instead of JSON
                const contentType = response.headers.get('content-type');
                let payload;
                if(contentType && contentType.includes('application/json')) {
                    payload = await response.json();  // Safe to parse as JSON
                    console.log("payload: ", payload);
                } else {
                    const text = await response.text();
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                }

                // Check if request was successful
                if(!response.ok) {
                    if(!response.ok) {
                        console.log(payload)
                        console.log(payload.message);
                        const errorMessage = payload.message;
                        setError(errorMessage);
                        throw new Error(errorMessage);
                    }
                }
                setData(payload);  // Save events data
            } catch (err) {
                if(err.name === 'AbortError') {
                    return;  // Request was cancelled (component unmounted), ignore error
                }
            } finally {
                setLoading(false);  // Always hide loading spinner
            }
        };
        fetchEvents();

        // Cleanup: Cancel request if component unmounts or dependencies change
        return () => controller.abort();
    }, [filters, page, refreshKey]);  // Re-run when filters, page, or refreshKey changes

    // Calculate total pages for pagination
    const totalPages = Math.max(1, Math.ceil((data.count || 0) / PAGE_SIZE));

    const clearFilters = () => {
        setFilters({
            name: '',
            location: '',
            started: "",
            ended: "",
            full: "",
            published: ""
        });
        setPage(1);
        // URL will be updated by the useEffect above
    }

    // Update a single filter value and reset to page 1
    // Resetting to page 1 ensures user sees results from the beginning when filters change
    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value
        }));
        setPage(1);  // Reset to first page when filters change
    };

    // Open the create/edit event modal (managers only)
    const handleModalOpen = (mode, event = null) => {
        console.log("mode: ", mode);
        if(event === null) {
            event = {};
        }
        setModalState({ open: true, mode, event });  // 'create' or 'edit' mode
        setModalError('');  // Clear any previous errors
    };

    // Close the create/edit event modal
    const closeModal = () => {
        setModalState({ open: false, mode: 'create', event: null });
        setModalError('');
    };

    // Handle saving a new or edited event (managers only)
    const handleModalSubmit = async (values) => {
        setModalBusy(true);      // Disable form to prevent double-submission
        setModalError('');
        console.log("values: ", values);
        try {
            const payload = values[0];  // Convert form values to API format

            // For creation, ensure all required fields are present
            const isEditing = modalState.mode === 'edit' && modalState.event?.id;
            if(!isEditing) {
                const name = payload.name;
                const description = payload.description;
                const location = payload.location;
                const startTime = payload.startTime;
                const endTime = payload.endTime;
                let missingFields = []
                if(!name) {
                    console.log("name: ", name);
                    missingFields.push('name');
                }
                if(!description) {
                    console.log("description: ", description);
                    missingFields.push('description');
                }
                if(!location) {
                    console.log("location: ", location);
                    missingFields.push('location');
                }
                if(!startTime) {
                    console.log("startTime: ", startTime);
                    missingFields.push('startTime');
                }
                if(!endTime) {
                    console.log("endTime: ", endTime);
                    missingFields.push('endTime');
                }
                if(missingFields.length > 0) {
                    setModalError(`Missing required fields: ${missingFields.join(', ')}`);
                    console.log("missingFields: ", missingFields);
                    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
                }
            }

            if(Object.keys(payload).length === 0) {
                setModalError("Nothing to save");
                throw new Error('Nothing to save');
            }

            // Determine endpoint and method
            const endpoint = isEditing ? `/events/${modalState.event.id}` : '/events';
            const method = isEditing ? 'PATCH' : 'POST';

            console.log(endpoint, method);

            const response = await authenticatedFetch(endpoint, {
                method,
                body: JSON.stringify(payload)
            });

            // authenticatedFetch handles 401 automatically
            if(response.status === 401) {
                throw new Error('Session expired. Please log in again.');
            }

            // Parse response safely
            const contentType = response.headers.get('content-type');
            let body;
            if(contentType && contentType.includes('application/json')) {
                body = await response.json();
            } else {
                const text = await response.text();
                body = { message: text || 'Unknown error' };
            }

            if(!response.ok) {
                // Log the payload for debugging
                console.log('Failed to save event. Payload:', payload);
                console.log('Response:', body);
                setModalError(body.message);
                throw new Error(body.message || body.Message || `Unable to save event (${response.status})`);
            }

            // Success! Show toast and refresh the list
            setToast(isEditing ? t('events.eventUpdated') : t('events.eventCreated'));
            closeModal();
            setRefreshKey((key) => key + 1);  // Trigger re-fetch

            // If editing from detail modal, close it too
            if(isEditing && detailModalOpen) {
                setDetailModalOpen(false);
            }
        } catch (err) {
            console.log(err);
        } finally {
            setModalBusy(false);  // Re-enable form
        }
    };

    // Delete a event (managers only)
    const handleDeleteEvent = async (event) => {
        // Check if event has already started (safety check)
        if(event.published === true) {
            setError(t('events.cannotDelete'));
            return;
        }

        // Confirm deletion - this is destructive and can't be undone
        const confirmed = window.confirm(t('eventDetail.deleteConfirm'));
        if(!confirmed) {
            return;  // User cancelled
        }
        try {
            const response = await authenticatedFetch(`/events/${event.id}`, {
                method: 'DELETE'
            });

            // authenticatedFetch handles 401 automatically
            if(response.status === 401) {
                throw new Error('Session expired. Please log in again.');
            }

            // DELETE returns 204 (No Content) on success, or JSON error on failure
            if(response.status !== 204) {
                const contentType = response.headers.get('content-type');
                let payload = {};
                if(contentType && contentType.includes('application/json')) {
                    payload = await response.json();
                } else {
                    const text = await response.text();
                    payload = text ? { message: text } : {};
                }
                // Extract error message from response
                const errorMessage = payload.message || payload.Message || `Unable to delete event (${response.status})`;
                setError(errorMessage);
                throw new Error(errorMessage);
            }
            setToast(t('events.eventDeleted'));
            setRefreshKey((key) => key + 1);  // Refresh the list
        } catch (err) {
            // Show error message to user
            const errorMsg = err.message || 'Unable to delete event';
            console.error('Delete event error:', errorMsg);
        }
    };

    // Show confirmation modal before adding event to wallet
    const handleApplyEventClick = (eventId) => {
        setEventToApply(eventId);
        setConfirmModalOpen(true);
    };

    // Actually add the event to wallet after user confirms
    const handleApplyEvent = async () => {
        if(!eventToApply) {
            return;
        }
        const eventId = eventToApply;
        setConfirmModalOpen(false);  // Close confirmation modal
        setApplyingId(eventId);  // Track which event is being added (for loading state)
        setToast('');
        try {
            const response = await authenticatedFetch(`/events/${eventId}/guests/me`, {
                method: 'POST'
            });

            // authenticatedFetch handles 401 automatically
            if(response.status === 401) {
                throw new Error('Session expired. Please log in again.');
            }

            // Parse response safely
            const contentType = response.headers.get('content-type');
            let payload;
            if(contentType && contentType.includes('application/json')) {
                payload = await response.json();
            } else {
                const text = await response.text();
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }

            if(!response.ok) {
                setError(payload.message || 'Unable to RSVP to event');
                throw new Error(payload.message || 'Unable to RSVP to event');
            }
            // Refresh to show updated status (no success popup)
            setRefreshKey((key) => key + 1);  // Trigger re-fetch
        } catch (err) {
            console.log(err);
        } finally {
            setApplyingId(null);  // Clear loading state
            setEventToApply(null);  // Clear event to apply
            setRefreshKey((key) => key + 1);  // Trigger re-fetch
        }
    };

    // Render a single event card
    // This function creates the JSX for each event in the grid
    const renderEventCard = (event) => {
        // Determine CSS class for status badge (active, upcoming, or ended)
        const isDisabled = Date.parse(event.endTime) <= Date.now();
        const upcoming = Date.parse(event.startTime) > Date.now();
        let statusClass = "";
        isDisabled ? statusClass = "status-ended" : statusClass = "status-active";

        // Determine if user can add this event to wallet (regular users + one-time events only)
        const canApply = isRegular && !user.attendedEvents.some(e => e.id === event.id) && !isDisabled;

        // Determine if card should be greyed out (disabled styling)
        // Cards are disabled if event is not usable, has ended, or is upcoming
        if(isDisabled) {
            event.status = t('status.ended');
        } else if(upcoming){
            event.status = t('status.upcoming');
        } else {
            event.status = t('status.occurring');
        }

        return (
            <article key={event.id} className={`promo-card ${isDisabled ? 'promo-card--disabled' : ''}`}>
                {/* Status and type badges at the top */}
                <div className="card-badges">
                    <span className={`promo-badge ${statusClass}`}>{event.status}</span>
                </div>

                {/* Event name and description */}
                <h3>{event.name}</h3>

                {/* Event metadata: valid through date, minimum spending, reward */}
                <div className="promo-card-meta">
                    <span>{t('events.starts')} {formatDate(event.startTime)}</span>
                    <span>{t('events.ends')} {formatDate(event.endTime)}</span>
                </div>

                {/* Action buttons */}
                <div className="promo-card-actions">
                    {/* "View details" button - opens popup modal for all users */}
                    <button className="secondary-btn" onClick={() => {
                        setSelectedEventId(event.id);  // Remember which event
                        setDetailModalOpen(true);              // Open the popup
                    }}>
                        {t('events.viewDetails')}
                    </button>

                    {/* "Add to wallet" button - only for regular users */}
                    {canApply && (
                        <button
                            className="primary-btn"
                            disabled={applyingId === event.id}  // Disable while adding
                            onClick={() => handleApplyEventClick(event.id)}
                        >
                            {applyingId === event.id ? t('events.adding') : !canApply ? t('events.alreadyRSVP') : t('events.rsvp')}
                        </button>
                    )}
                </div>

                {/* Manager-only actions: Edit button */}
                {/*
                {isManager && (
                    <div className="promo-card-actions">
                        <button className="secondary-btn" onClick={() => handleModalOpen('edit', event)}>
                            Edit
                        </button>
                    </div>
                )} */}
            </article>
        );
    };

    return (
        <div className="events-page container">
            {/* Page header with title and "New event" button (managers only) */}
            <div className="page-header">
                <div className="events-section">
                    <h1>{t('events.title')}</h1>
                    <p>{t('events.subtitle')}</p>
                </div>
                <div className="page-actions">
                    {toast && <span className="toast">{toast}</span>}
                    {isManager && (
                        <button className="primary-btn" onClick={() => handleModalOpen('create')}>
                            {t('events.newEvent')}
                        </button>
                    )}
                </div>
            </div>

            {/* Filter panel with basic and advanced filters */}
            <section className="filters-panel">
                {/* Basic filters row: search, status, type, and advanced filters toggle */}
                <div className="filters-row">
                    <input
                        type="search"
                        placeholder="Search by name"
                        value={filters.name}
                        onChange={(event) => handleFilterChange('name', event.target.value)}
                    />\

                    <input
                        type="search"
                        placeholder="Search by location"
                        value={filters.location}
                        onChange={(event) => handleFilterChange('location', event.target.value)}
                    />
                    {/* Type filter: automatic, onetime, or all */}
                    <select value={filters.started} onChange={(event) => handleFilterChange('started', event.target.value)}>
                        <option value="" disabled>Select started status</option>
                        <option value="true">Started</option>
                        <option value="false">Not Started</option>
                    </select>
                    <select value={filters.ended} onChange={(event) => handleFilterChange('ended', event.target.value)}>
                        <option value="" disabled>Select ended status</option>
                        <option value="true">Ended</option>
                        <option value="false">Not Ended</option>
                    </select>
                    <select value={filters.full} onChange={(event) => handleFilterChange('full', event.target.value)}>
                        <option value="" disabled>Select capacity</option>
                        <option value="true">Full</option>
                        <option value="false">Not Full</option>
                    </select>
                    {isManager && (
                        <select value={filters.published} onChange={(event) => handleFilterChange('published', event.target.value)}>
                            <option value="" disabled>Published?</option>
                            <option value="true">Published.</option>
                            <option value="false">Not Published</option>
                        </select>
                    )}
                    <button type="button" className="filters-toggle" onClick={clearFilters}>
                        {t('events.clearFilters')}
                    </button>
                </div>
            </section>

            {/* Error message display */}
            {error && <Error error={error} />}

            {/* Main content area: loading, empty state, or events grid */}
            {loading ? (
                <Loading message={t('events.loading')} />
            ) : data.results.length === 0 ? (
                <div className="events-empty">
                    <p>{t('events.noMatches')}</p>
                </div>
            ) : (
                <section className="events-grid">
                    {/* Render each event as a card in a 4-column grid */}
                    {data.results.map(renderEventCard)}
                </section>
            )}

            {/* Pagination controls - only show if more than one page */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button type="button" disabled={page === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                        Previous
                    </button>
                    <span className="results-meta">Page {page} of {totalPages}</span>
                    <button
                        type="button"
                        disabled={page === totalPages}
                        onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Modal for creating/editing events (managers only) */}
            <EventEditorModal
                isOpen={modalState.open}
                mode={modalState.mode}
                initialValues={modalState.event}
                busy={modalBusy}
                error={modalError}
                onClose={closeModal}
                onSubmit={handleModalSubmit}
            />

            {/* Modal for viewing event details (all users) */}
            {/* Opens when user clicks "View details" button on any event card */}
            <EventDetailModal
                eventId={selectedEventId}
                isOpen={detailModalOpen}
                onClose={() => {
                    setDetailModalOpen(false);
                    setSelectedEventId(null);
                }}
                onEventUpdated={() => setRefreshKey((key) => key + 1)}
            />


            {/* Confirmation modal - asks user to confirm before adding event to wallet */}
            <ConfirmModal
                isOpen={confirmModalOpen}
                title="RSVP?"
                message="Are you sure you want to RSVP to this event?"
                confirmText="RSVP"
                cancelText="Cancel"
                onConfirm={handleApplyEvent}
                onCancel={() => {
                    setConfirmModalOpen(false);
                    setEventToApply(null);
                }}
                onEventUpdated={() => setRefreshKey((key) => key + 1)}
            />
        </div>
    );
}

export default Events;
