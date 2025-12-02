import {useContext, useEffect, useState} from 'react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { UserContext } from '../contexts/UserContext.jsx';
import './EventEditorModal.css';

const DEFAULT_FORM = {
    name: '',
    description: '',
    location: '',
    startTime: '',
    endTime: '',
    capacity: '',
    pointsRemain: '',
    placeId: '',
};

const UTORID = {
    toRemove: {
        guestUtorid: "",
        organizerUtorid: "",
    },
    toAdd: {
        guestUtorid: "",
        organizerUtorid: "",
    }
};

const toInputValue = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
};

function EventEditorModal({ isOpen, mode = 'create', initialValues = {}, onClose, onSubmit, busy = false, error = '' }) {
    const { user, refreshUserData } = useContext(UserContext);
    const isManager = user?.role === 'manager' || user?.role === 'superuser';
    const { t } = useLanguage();
    const [formValues, setFormValues] = useState(DEFAULT_FORM);
    const [payloadValues, setPayloadValues] = useState({});
    const [utorids, setUtorids] = useState(UTORID);

    useEffect(() => {
        if(isOpen) {
            const values = initialValues || {};

            let defaultStartTime = '';
            let defaultEndTime = '';
            if(mode === 'create' && !values.startTime) {
                console.log("defaultStartTime");
                const futureTime = new Date();
                futureTime.setMinutes(futureTime.getMinutes() + 10); // 10 minutes from now
                defaultStartTime = toInputValue(futureTime);

                // For new promotions, set default end time to 1 hour after start time
                if(!values.endTime) {
                    console.log("defaultEndTime");
                    const endTime = new Date(futureTime);
                    endTime.setHours(endTime.getHours() + 1); // 1 hour after start time
                    defaultEndTime = toInputValue(endTime);
                }
            }
            setFormValues({
                name: initialValues.name || '',
                description: initialValues.description || '',
                location: initialValues.location || '',
                startTime: initialValues.startTime ? toInputValue(initialValues.startTime) : defaultStartTime,
                endTime: initialValues.endTime ? toInputValue(initialValues.endTime) : defaultEndTime,
                capacity: initialValues.capacity || '',
                pointsRemain: initialValues.pointsRemain || '',
                placeId: initialValues.placeId || '',
                published: initialValues.published || '',
            });
        } else {
            setFormValues(DEFAULT_FORM);
        }
    }, [isOpen, initialValues]);

    if(!isOpen) {
        return null;
    }

    const handleChange = (event) => {
        let { name, value } = event.target;

        if (name === "published") {
            value = value === "true";
        }

        if (name === "startTime" || name === "endTime") {
            const uiValue = value;
            const isoValue = value ? new Date(value).toISOString() : null;

            setFormValues(prev => ({ ...prev, [name]: uiValue }));
            setPayloadValues(prev => ({ ...prev, [name]: isoValue }));
            return;
        }

        if (name === "capacity" || name === "pointsRemain") {
            const raw = value;
            const numeric = raw === "" ? null : Number(raw);
            setFormValues(prev => ({
                ...prev,
                [name]: raw === "" ? "" : numeric
            }));

            const payloadKey = name === "pointsRemain" ? "points" : name;

            setPayloadValues(prev => ({
                ...prev,
                [payloadKey]: numeric
            }));

            return;
        }
        
        setFormValues(prev => ({ ...prev, [name]: value }));
        setPayloadValues(prev => ({ ...prev, [name]: value }));
    };

    const handleUtoridChange = (user) => {
        let { name, value } = user.target;
        let utoridPayload = utorids;
        if(name === "addOrganizer") {
            utoridPayload.toAdd.organizer = value;
        }
        if(name === "removeOrganizer") {
            utoridPayload.toRemove.organizer = value;
        }
        if(name === "addGuest") {
            utoridPayload.toAdd.guest = value;
        }
        if(name === "removeGuest") {
            utoridPayload.toRemove.guest = value;
        }
        setUtorids(utoridPayload);
    }

    const handleSubmit = async (event) => {
        event.preventDefault();
        console.log("payloadValues: ", payloadValues);
        console.log("utorids: ", utorids);
        const submitted = await onSubmit?.([payloadValues, utorids]);
        console.log("submitted", submitted);
        if(submitted === 0) {
            setPayloadValues({});
            setFormValues(DEFAULT_FORM);
            setUtorids(UTORID);
            if(refreshUserData) {
                await refreshUserData();
            }
        }
    };

    const handleClose = (e) => {
        e.preventDefault();
        setPayloadValues({});
        setFormValues(DEFAULT_FORM);
        setUtorids(UTORID);
        onClose();
    }

    return (
        <div className="event-modal-overlay" role="dialog" aria-modal="true">
            <div className="event-modal">
                <header className="event-modal__header">
                    <h3>{mode === 'edit' ? t('editor.editEvent') : t('editor.createEvent')}</h3>
                    <button className="modal-close-btn" type="button" onClick={handleClose} aria-label={t('common.close')}>×</button>
                </header>
                <form className="event-modal__form" onSubmit={handleSubmit}>
                    <label>
                        {t('editor.eventName')}
                        <input
                            type="text"
                            name="name"
                            value={formValues.name}
                            onChange={handleChange}
                        />
                    </label>
                    <label>
                        {t('editor.description')}
                        <textarea
                            name="description"
                            value={formValues.description}
                            onChange={handleChange}
                            rows={3}
                        />
                    </label>
                    <label>
                        {t('editor.location')}
                        <input
                            type="text"
                            name="location"
                            value={formValues.location}
                            onChange={handleChange}
                        />
                    </label>
                    <div className="modal-grid">
                        {(Date.parse(initialValues.startTime) > Date.now() || mode === "create") && (
                            <label>
                                Starts at
                                <input
                                    type="datetime-local"
                                    name="startTime"
                                    value={formValues.startTime}
                                    onChange={handleChange}
                                />
                            </label>
                        )}
                        {Date.parse(initialValues.startTime) <= Date.now() && (
                            <label>
                                Starts at
                                <input
                                    type="datetime-local"
                                    name="startTime"
                                    value={formValues.startTime}
                                    disabled
                                />
                            </label>
                        )}
                        {(Date.parse(initialValues.endTime) > Date.now() || mode === "create") && (
                            <label>
                                Ends at
                                <input
                                    type="datetime-local"
                                    name="endTime"
                                    value={formValues.endTime}
                                    onChange={handleChange}
                                />
                            </label>
                        )}
                        {Date.parse(initialValues.endTime) <= Date.now() && (
                            <label>
                                Ends at
                                <input
                                    type="datetime-local"
                                    name="endTime"
                                    value={formValues.endTime}
                                    disabled
                                />
                            </label>
                        )}
                        <label>
                            {t('editor.capacity')}
                            <input
                                type="number"
                                name="capacity"
                                value={formValues.capacity}
                                onChange={handleChange}
                            />
                        </label>
                        {isManager && (
                            <>
                                <label>
                                    Published
                                    <select name="published" value={formValues.published} onChange={handleChange}>
                                        <option value="" disabled>Published?</option>
                                        <option value="true">true</option>
                                        <option value="false">false</option>
                                    </select>
                                </label>
                                <label>
                                    Points
                                    <input
                                        type="number"
                                        name="pointsRemain"
                                        value={formValues.pointsRemain}
                                        onChange={handleChange}
                                    />
                                </label>
                            </>
                        )}
                        <label>
                            PlaceId
                            <input
                                type="text"
                                name="placeId"
                                value={formValues.placeId}
                                onChange={handleChange}
                            />
                        </label>
                        {mode !== "create" && (
                            <>
                            <p>Organizer and Guest management</p>
                            <br></br>
                                {isManager && (
                                    <>
                                        <label>
                                        {t('editor.addOrganizer')}
                                        <input
                                            type="text"
                                            name="addOrganizer"
                                            value={utorids.toAdd.organizer}
                                            onChange={handleUtoridChange}
                                        />
                                        </label>
                                        <label>
                                        {t('editor.removeOrganizer')}
                                        <input
                                            type="text"
                                            name="removeOrganizer"
                                            value={utorids.toRemove.organizer}
                                            onChange={handleUtoridChange}
                                        />
                                        </label>
                                    </>
                                )}
                            <label>
                                {t('editor.addGuest')}
                                <input
                                    type="text"
                                    name="addGuest"
                                    value={utorids.toAdd.guest}
                                    onChange={handleUtoridChange}
                                />
                            </label>
                                { isManager && (
                                    <label>
                                        {t('editor.removeGuest')}
                                        <input
                                            type="text"
                                            name="removeGuest"
                                            value={utorids.toRemove.guest}
                                            onChange={handleUtoridChange}
                                        />
                                    </label>
                                )}
                        </>
                    )}
                    </div>
                    {error && <p className="modal-error">{error}</p>}
                    <div className="modal-actions">
                        <button type="button" className="secondary-btn" onClick={handleClose} disabled={busy}>
                            {t('common.cancel')}
                        </button>
                        <button type="submit" className="primary-btn" disabled={busy}>
                            {busy ? t('common.saving') : mode === 'edit' ? t('editor.saveChanges') : t('editor.createEvent')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default EventEditorModal;

