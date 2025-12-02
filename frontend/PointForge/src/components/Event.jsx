import './Event.css';
import { formatDate } from '../utils/dateUtils.js';

function Event({event, onDetailClick}) {
    if (!event) {
        return null;
    }

    const  handleClick = (e) => {
        if(onDetailClick && event.id){
            e.preventDefault()
            onDetailClick(event.id);
        }

    }

    return ( 
        <li className="event-card">
            <button className="promotion-card-link promotion-card-button" onClick={handleClick}>
                <div className="event-left">
                    <h3 className="event-title">{event.name}</h3>
                    <p className="event-location">{event.location}</p>
                </div>
                <div className="event-right">
                    <p className="event-time">{formatDate(event.startTime)}</p>
                </div>
            </button>
        </li>
    )
}

export default Event;