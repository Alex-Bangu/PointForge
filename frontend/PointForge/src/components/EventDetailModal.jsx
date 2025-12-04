import { useContext, useEffect, useState } from 'react';
import { UserContext } from '../contexts/UserContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import Loading from './Loading.jsx';
import Error from './Error.jsx';
import EventEditorModal from './EventEditorModal.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import GoogleMapsEmbed from './GoogleMapsEmbed.jsx';
import { authenticatedFetch } from '../utils/api.js';
import { formatDate } from '../utils/dateUtils.js';
import './EventDetailModal.css';

/**
 * Event Detail Modal
 * @param {string} eventId - ID of the event to display
 * @param {boolean} isOpen - Whether the modal is currently open
 * @param {function} onClose - Callback to close the modal
 * @param {function} onEventUpdated - Callback when event is updated (refreshes parent list)
 */
function EventDetailModal({ eventId, isOpen, onClose, onEventUpdated }) {
    // Get current user to determine permissions and refresh function
    const { user, refreshUserData } = useContext(UserContext);
    const { t } = useLanguage();
    const isOrganizer = user?.organizedEvents.some((u) => u.id === eventId);
    const isManager = user?.role === 'manager' || user?.role === 'superuser';
    console.log("isOrganizer: ", isOrganizer);
    console.log("isManager: ", isManager);

    // State for the event data being displayed
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);      // Loading state while fetching
    const [error, setError] = useState('');            // Error message if fetch fails

    // State for confirmation modal before adding to wallet
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);

    // State for confirmation modal before removing from wallet
    const [removeConfirmModalOpen, setRemoveConfirmModalOpen] = useState(false);

    // State for the edit event modal (nested modal for managers)
    const [modalOpen, setModalOpen] = useState(false);
    const [modalBusy, setModalBusy] = useState(false);
    const [modalError, setModalError] = useState('');
    const [carryModalError, setCarryModalError] = useState('');

    // State for adding events to wallet (regular users)
    const [applying, setApplying] = useState(false);

    // State for removing events from wallet (regular users)
    const [removing, setRemoving] = useState(false);

    // Refresh key to force re-fetch when event is updated
    const [refreshKey, setRefreshKey] = useState(0);


    // Fetch event data when modal opens
    // Only fetches if modal is open and we have a eventId
    useEffect(() => {
        if(!isOpen || !eventId) {
            return;  // Don't fetch if modal is closed or no ID provided
        }

        const controller = new AbortController();  // Allows canceling request

        const fetchEvent = async () => {
            setLoading(true);
            setError('');
            try {
                // Fetch event details from API
                const response = await authenticatedFetch(`/events/${eventId}`, {
                    signal: controller.signal
                });
                const payload = await response.json();
                if(!response.ok) {
                    throw new Error(payload.message || payload.Message || t('error.unableToLoad') + ' event');
                }
                setEvent(payload);  // Save event data
                console.log("payload: ", payload);
            } catch (err) {
                if(err.name === 'AbortError') {
                    return;  // Request was cancelled, ignore
                }
                setError(err.message || t('error.unableToLoad') + ' event');
            } finally {
                setLoading(false);
            }
        };
        fetchEvent();

        // Cleanup: Cancel request if modal closes or component unmounts
        return () => controller.abort();
    }, [eventId, refreshKey, isOpen]);

    // Refresh event data (called after adding to wallet or editing)
    const refresh = () => {
        setRefreshKey((key) => key + 1);  // Increment key to trigger re-fetch
        if(onEventUpdated) {
            onEventUpdated();  // Notify parent to refresh its list too
        }
    };

    // Show confirmation modal before adding to wallet
    // Hide the detail modal overlay to prevent stacking
    const handleApplyClick = () => {
        if(!event) {
            return;
        }
        setConfirmModalOpen(true);
    };

    // Actually RSVP to the event after user confirms
    const handleApply = async () => {
        console.log("applying");
        if(!event) {
            return;
        }
        setConfirmModalOpen(false);  // Close confirmation modal
        setApplying(true);
        try {
            const response = await authenticatedFetch(`/events/${event.id}/guests/me`, {
                method: 'POST'
            });

            // authenticatedFetch handles 401 automatically
            if(response.status === 401) {
                throw new Error(t('error.sessionExpired'));
            }

            const contentType = response.headers.get('content-type');
            let payload;
            if(contentType && contentType.includes('application/json')) {
                payload = await response.json();
            } else {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }

            if(!response.ok) {
                throw new Error(payload.message || t('eventDetail.rsvpToEvent') + ' failed');
            }
            // Refresh user data (which includes events) before closing modal
            // This ensures the wallet list updates immediately
            if(refreshUserData) {
                await refreshUserData();
            }
            // Notify parent to refresh its list as well
            if(onEventUpdated) {
                onEventUpdated();
            }
            setApplying(false);
            onClose();
        } catch (err) {
            setError(err.message || t('eventDetail.rsvpToEvent') + ' failed');
            setApplying(false);  // Only set applying to false on error (on success, modal closes)
        }
    };

    // Show confirmation modal before removing from wallet
    // Hide the detail modal overlay to prevent stacking
    const handleRemoveClick = () => {
        if(!event) {
            return;
        }
        setRemoveConfirmModalOpen(true);
    };

    // Actually remove the event from wallet after user confirms
    const handleRemove = async () => {
        console.log("removing");
        if(!event) {
            return;
        }
        setRemoveConfirmModalOpen(false);  // Close confirmation modal
        setRemoving(true);
        try {
            const response = await authenticatedFetch(`/events/${event.id}/guests/me`, {
                method: 'DELETE'
            });

            // authenticatedFetch handles 401 automatically
            if(response.status === 401) {
                throw new Error(t('error.sessionExpired'));
            }

            const payload = response.body;

            if(!response.ok) {
                console.log("unable");
                throw new Error(payload.message || t('eventDetail.rescindRSVP') + ' failed');
            }
            // Refresh user data (which includes events) before closing modal
            // This ensures the wallet list updates immediately
            if(refreshUserData) {
                await refreshUserData();
            }
            // Notify parent to refresh its list as well
            if(onEventUpdated) {
                onEventUpdated();
            }
            console.log("end of removing");
            setRemoving(false);
            onClose();
        } catch (err) {
            console.log("error came up");
            setError(err.message || t('eventDetail.rescindRSVP') + ' failed');
            setRemoving(false);  // Only set removing to false on error (on success, modal closes)
        }
    };

    // Delete event (managers only)
    const handleDelete = async () => {
        if(!event) {
            return;
        }
        // Confirm deletion - destructive action
        const confirmed = window.confirm(t('eventDetail.deleteConfirm'));
        if(!confirmed) {
            return;
        }
        try {
            const response = await authenticatedFetch(`/events/${event.id}`, {
                method: 'DELETE'
            });
            if(response.status !== 204) {
                const payload = await response.json().catch(() => ({}));
                if(!response.ok) {
                    throw new Error(payload.message || payload.Message || t('error.unableToDelete') + ' event');
                }
            }
            onClose();  // Close modal after successful deletion
            if(onEventUpdated) {
                onEventUpdated();  // Refresh parent list
            }
        } catch (err) {
            setError(err.message || t('error.unableToDelete') + ' event');
        }
    };

    // Save edited event (managers only)
    const handleSave = async (values) => {
        if(!event) {
            return;
        }
        setModalBusy(true);
        setModalError('');
        console.log("values: ", values);
        try {
            const response = await authenticatedFetch(`/events/${event.id}`, {
                method: 'PATCH',
                body: JSON.stringify(values)
            });
            const body = await response.json().catch(() => ({}));
            if(!response.ok) {
                console.log(body)
                console.log(body.message);
                const errorMessage = body.message;
                setCarryModalError(errorMessage);
                throw new Error(errorMessage);
            }
        } catch (err) {
            console.log(err);
            return 1;
        } finally {
            setModalBusy(false);
        }
        return 0;
    };

    const handleUtoridActions = async (values) => {
        if(!event) {
            return;
        }
        setModalBusy(true);
        setModalError('');
        console.log("values: ", values);
        const removeOrganizer = values.toRemove.organizer;
        const removeGuest = values.toRemove.guest;
        const addOrganizer = values.toAdd.organizer;
        const addGuest = values.toAdd.guest;
        try {
            if(removeOrganizer) {
                const response = await authenticatedFetch(`/events/${event.id}/organizers/${removeOrganizer}`, {
                    method: 'DELETE',
                });
                if (response.status !== 204) {
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        setCarryModalError(payload.message);
                        throw new Error(payload.message || payload.Message || 'Unable to delete event');
                    }
                }
            }
            if(removeGuest) {
                const response = await authenticatedFetch(`/events/${event.id}/guests/${removeGuest}`, {
                    method: 'DELETE'
                });
                if (response.status !== 204) {
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        setCarryModalError(payload.message);
                        throw new Error(payload.message || payload.Message || 'Unable to delete event');
                    }
                }
            }
            if(addOrganizer) {
                const response = await authenticatedFetch(`/events/${event.id}/organizers`, {
                    method: 'POST',
                    body: JSON.stringify({utorid: addOrganizer}),
                });
                const body = await response.json().catch(() => ({}));
                if(!response.ok) {
                    console.log(body)
                    console.log(body.message);
                    const errorMessage = body.message;
                    setCarryModalError(errorMessage);
                    throw new Error(errorMessage);
                }
            }
            if(addGuest) {
                const response = await authenticatedFetch(`/events/${event.id}/guests`, {
                    method: 'POST',
                    body: JSON.stringify({utorid: addGuest}),
                });
                const body = await response.json().catch(() => ({}));
                if(!response.ok) {
                    console.log(body)
                    console.log(body.message);
                    const errorMessage = body.message;
                    setCarryModalError(errorMessage);
                    throw new Error(errorMessage);
                }
            }
        } catch (err) {
            console.log(err);
            return 1;
        } finally {
            setModalBusy(false);
        }
        return 0;
    };

    const handleEditorSave = async (payloads) => {
        console.log("payloads: ", payloads);
        const save = await handleSave(payloads[0]);
        const utorids = await handleUtoridActions(payloads[1]);
        if( save === 0 && utorids === 0) {
            setModalOpen(false);  // Close edit modal
            refresh();  // Refresh to show updated data
            console.log("refreshed");
            setCarryModalError('');
            setModalError('');
        } else {
            console.log("carryModal: ", carryModalError);
            setModalError(carryModalError);
        }
        return save || utorids;
    }

    const showDetailModal = isOpen && !confirmModalOpen && !removeConfirmModalOpen;

    // Keep component mounted if confirmation modals are open, even if detail modal is closed
    const shouldRender = isOpen || confirmModalOpen || removeConfirmModalOpen;

    // Handle clicking outside modal to close it
    // Only closes if clicking the overlay (dark background), not the modal itself
    const handleOverlayClick = (e) => {
        if(e.target === e.currentTarget) {
            onClose();
        }
    };

    // Don't render anything if modal is closed
    if(!shouldRender) {
        return null;
    }

    // Show loading spinner while fetching event data
    if(loading && showDetailModal) {
        return (
            <div className="event-detail-modal-overlay" onClick={handleOverlayClick}>
                <div className="event-detail-modal" onClick={(e) => e.stopPropagation()}>
                    <Loading message={t('eventDetail.loading')} />
                </div>
            </div>
        );
    }

    // Show error if fetch failed and we don't have event data
    if(error && !event && showDetailModal) {
        return (
            <div className="event-detail-modal-overlay" onClick={handleOverlayClick}>
                <div className="event-detail-modal" onClick={(e) => e.stopPropagation()}>
                    <Error error={error} />
                </div>
            </div>
        );
    }

    // Safety check: don't render if no event data
    if(!event) {
        return null;
    }

    // Calculate event status and format display values
    const statusKey = (Date.parse(event.startTime) > Date.now()) ? 'upcoming' : (Date.parse(event.startTime) <= Date.now() && Date.parse(event.endTime) > Date.now()) ? 'active' : 'ended';
    const statusLabel = (Date.parse(event.startTime) > Date.now()) ? t('eventDetail.statusUpcoming') : (Date.parse(event.startTime) <= Date.now() && Date.parse(event.endTime) > Date.now()) ? t('eventDetail.statusActive') : t('eventDetail.statusEnded');
    const location = event.location
    const capacity = event.full ? t('eventDetail.eventFull') : t('eventDetail.availableToRSVP');

    // Determine if user can add this event to wallet
    const ended = Date.parse(event.endTime) <= Date.now()
    const upcoming = Date.parse(event.startTime) > Date.now()

    return (
        <>
        {showDetailModal && (
        <div className="event-detail-modal-overlay" onClick={handleOverlayClick}>
            <div className="event-detail-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header with name, status badges, and close button */}
                <div className="event-detail-header">
                    <div className="event-detail-header-wrapper">
                        {/* Event name comes first for better visual hierarchy */}
                        <h2>{event.name}</h2>
                        {/* Status and type badges */}
                        <div className="card-badges">
                            <span className={`promo-badge status-${statusKey.replace(/\s+/g, '-')}`}>{statusLabel}</span>
                        </div>
                    </div>
                    {/* X button to close modal - positioned at top right */}
                    <button className="event-detail-modal-close" onClick={onClose} aria-label="Close">×</button>
                </div>

                {/* Event description */}
                <p>{event.description}</p>

                {/* Reward and minimum spending information in a grid */}
                <div className="event-meta-grid">
                    <div className="event-meta-item">
                        <span>{t('eventDetail.location')}</span>
                        <strong>{location}</strong>
                    </div>
                    <div className="event-meta-item">
                        <span>{t('eventDetail.capacity')}</span>
                        <strong>{capacity}</strong>
                    </div>
                </div>
                <GoogleMapsEmbed
                    placeId={event.placeId}
                />

                {/* Manager-only action buttons */}
                <div className="event-cta">
                    {(isManager || isOrganizer) && (
                            <button className="secondary-btn" onClick={() => setModalOpen(true)}>
                                {t('eventDetail.editEvent')}
                            </button>
                    )}
                    {isManager && (
                        <button className="secondary-btn" onClick={handleDelete}>
                            {t('eventDetail.deleteEvent')}
                        </button>
                    )}
                </div>

                {/* Footer with validity and eligibility information */}
                <div className="event-detail-footer">
                    {/* Show "Valid through" date if available */}
                    {event.endTime && (
                        <span className="valid-through">{formatDate(event.startTime)} - {formatDate(event.endTime)} </span>
                    )}

                    {/* Regular user view: eligibility message and redeem button */}
                    {!isManager && (
                        <div className="event-eligibility-message">
                            {/* Single merged message explaining eligibility and usage status */}
                            <span>
                                {event.attending
                                    ? t('eventDetail.alreadyRSVP')
                                    : ended
                                        ? t('eventDetail.hasEnded')
                                        : upcoming
                                            ? t('eventDetail.startsSoon')
                                            : !event.full
                                                ? t('eventDetail.notRSVPNotFull')
                                                : t('eventDetail.notRSVPFull')}
                            </span>
                            {/* Add to wallet button - only shown for eligible, usable, one-time events */}
                            {!event.attending && !ended && !event.full && (
                                <button className="primary-btn redeem-btn" disabled={applying} onClick={handleApplyClick}>
                                    {applying ? t('common.adding') : t('eventDetail.rsvpToEvent')}
                                </button>
                            )}
                            {/* Remove from wallet button - only shown for events already in wallet */}
                            {event.attending && !ended && (
                                <button className="secondary-btn" disabled={removing} onClick={handleRemoveClick}>
                                    {removing ? t('common.removing') : t('eventDetail.rescindRSVP')}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Manager view: user statistics and status */}
                    {(isManager || isOrganizer) && (
                        <>
                            <span>{event.guests.length} {t('eventDetail.guestsRSVP')}</span>
                            <p>{t('eventDetail.guests')} </p>
                            {event.guests.map((guest, index) => (
                                <span key={index}>{guest.utorid}</span>
                            ))}
                        </>
                    )}
                </div>

                {/* Nested modal for editing event (managers only) */}
                <EventEditorModal
                    isOpen={modalOpen}
                    mode="edit"
                    initialValues={event}
                    busy={modalBusy}
                    error={modalError}
                    onClose={() => {
                        setModalOpen(false);
                        setModalError('');
                    }}
                    onSubmit={handleEditorSave}
                />
            </div>
        </div>
        )}



                {/* Confirmation modal - asks user to confirm before adding event to wallet */}
                <ConfirmModal
                    isOpen={confirmModalOpen}
                    title={t('eventDetail.confirmRSVPTitle')}
                    message={t('eventDetail.confirmRSVPMessage')}
                    confirmText={t('eventDetail.confirmRSVPButton')}
                    cancelText={t('common.cancel')}
                    onConfirm={handleApply}
                    onCancel={() => {
                        setConfirmModalOpen(false);
                    }}
                />

                {/* Confirmation modal - asks user to confirm before removing event from wallet */}
                <ConfirmModal
                    isOpen={removeConfirmModalOpen}
                    title={t('eventDetail.confirmRescindTitle')}
                    message={t('eventDetail.confirmRescindMessage')}
                    confirmText={t('eventDetail.confirmRescindButton')}
                    cancelText={t('common.cancel')}
                    onConfirm={handleRemove}
                    onCancel={() => {
                        setRemoveConfirmModalOpen(false);
                    }}
                />
        </>
    );
}

export default EventDetailModal;

