// External service: Google Maps Embed API
// Source: https://developers.google.com/maps/documentation/embed/get-started
// Used for displaying event locations on event detail pages
function GoogleMapsEmbed({ placeId }) {
    const src = `https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&q=place_id:${placeId}`;
    console.log("placeId: ", placeId);

    return (
        <iframe
            title="Google Map"
            width="100%"
            height="450"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            src={src}
        />
    );
}

export default GoogleMapsEmbed;