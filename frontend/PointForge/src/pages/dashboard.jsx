import { UserContext } from "../contexts/UserContext.jsx"
import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Event, Promotion, Transaction, EmptyState, Loading, Error, PromotionDetailModal, EventDetailModal, TransactionDetailModal, UserDetailModal } from "../components";
import { filterUpcoming } from "../utils/dateUtils.js";
import { useManagerData } from "../hooks/useManagerData.js";
import { useLanguage } from "../contexts/LanguageContext.jsx";
import "./dashboard.css";

function Dashboard() {
    // Get user data and context information
    const {user, loading, error, events, transactions} = useContext(UserContext);
    const {t} = useLanguage();
    const navigate = useNavigate();
    
    // State for promotion detail popup modal
    // When a promotion is clicked, we store its ID and open the modal
    const [promotionModalOpen, setPromotionModalOpen] = useState(false);         // Whether popup is open
    const [selectedPromotionId, setSelectedPromotionId] = useState(null);   // Which promotion to show
    const [eventModalOpen, setEventModalOpen] = useState(null);
    const [selectedEventId, setSelectedEventId] = useState(null);
    const [transactionModalOpen, setTransactionModalOpen] = useState(false);
    const [selectedTransactionId, setSelectedTransactionId] = useState(null);
    const [userModalOpen, setUserModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);

    const role = user?.role ?? 'regular';
    const isRegular = role === 'regular';
    const isCashier = role === 'cashier';
    const isManagerOrSuperuser = role === 'manager' || role === 'superuser';

    // Use custom hook for manager data
    const { userSummary, promotionsCount, activePromotions: managerActivePromotions, error: managerError, loading: managerLoading, refresh: refreshManagerData } = useManagerData(user);

    // Early returns AFTER all hooks
    if(loading) {
        return <Loading />;
    }

    if(error) {
        return <Error error={`Error: ${error}`} container />;
    }

    // If user is null (logged out), don't try to render - navigation should happen soon
    if(!user) {
        return <Loading />;
    }

    const upcomingEvents = filterUpcoming(events);
    // For regular users: show promotions from their wallet (user.promotions - promotions they've added)
    // For managers: use the fetched active promotions
    const walletPromotions = isManagerOrSuperuser 
        ? (managerActivePromotions || []).slice(0, 5)
        : (user?.promotions || []).slice(0, 5);
    const recentTransactions = transactions.slice(0, 5);

    const upcomingEventsCount = filterUpcoming(events).length;
    console.log("upcomingEvents", upcomingEventsCount);

    // For regular users: count promotions in wallet (user.promotions)
    // For managers: use the fetched count
    const walletPromotionsCount = isManagerOrSuperuser 
        ? promotionsCount 
        : (user?.promotions || []).length;

    const eventlist = upcomingEvents.map((event, index) => (
        <Event
            key={event.id || index}
            event={event}
            onDetailClick={(id) => {
                setSelectedEventId(id);
                setEventModalOpen(true);
            }}
        />
    )).slice(0, 5);

    // Create list of promotion cards
    // Pass onDetailClick callback so clicking a promotion opens the popup modal
    // instead of navigating to a separate page
    const promotionslist = walletPromotions.map((promotion, index) => (
        <Promotion 
            key={promotion.id || index} 
            promotion={promotion} 
            onDetailClick={(id) => {
                setSelectedPromotionId(id);      // Remember which promotion was clicked
                setPromotionModalOpen(true);         // Open the popup modal
            }}
        />
    ));

    const transactionslist = recentTransactions.map((transaction, index) => (
        <Transaction 
            key={transaction.id || index} 
            transaction={transaction}
            onDetailClick={(id) => {
                setSelectedTransactionId(id);
                setTransactionModalOpen(true);
            }}
        />
    ));

    const handleCashierNavigate = (mode) => {
        if (mode === 'create') {
            navigate('/dashboard/cashier/create-purchase');
        } else if (mode === 'redeem') {
            navigate('/dashboard/cashier/process-redemption');
        }
    };

    const flaggedUsersList = managerLoading
        ? <EmptyState message="Loading user signals..." />
        : (userSummary.flagged.length > 0
            ? userSummary.flagged.map((flaggedUser) => (
                <li key={flaggedUser.id} className="manager-user-row">
                    <button 
                        className="manager-user-row-button"
                        onClick={() => {
                            setSelectedUserId(flaggedUser.id);
                            setUserModalOpen(true);
                        }}
                    >
                        <div>
                            <strong>{flaggedUser.name || flaggedUser.utorid}</strong>
                            <p className="manager-user-subtitle">{flaggedUser.utorid}</p>
                        </div>
                        <span className={`status-pill ${flaggedUser.verified ? '' : 'status-pill--warning'}`}>
                            {flaggedUser.role}
                        </span>
                    </button>
                </li>
            ))
            : <EmptyState message="No flagged users" />);

    const cashierShortcuts = [
        {
            mode: "create"
        },
        {
            mode: "redeem"
        }
    ];

    return (
        <div className="container">
            <div className="welcome-section">
                <div className="welcome-header">
                    <div>
                        <h1 className="welcome-title">{t('dashboard.welcome', {name: user.name})}</h1>
                        <p className="welcome-subtitle">{t('dashboard.overview')}</p>
                    </div>
                </div>
            </div>

            {isRegular && (
                <div className="gridLayout">
                    <div className="gridItem overview-card">
                        <div className="card-text">
                            <p className="card-label">{t('dashboard.yourPoints')}</p>
                            <p className="card-value">{user.points?.toLocaleString() || 0}</p>
                        </div>
                    </div>

                    <div className="gridItem overview-card">
                        <div className="card-text">
                            <p className="card-label">{t('dashboard.upcomingEvents')}</p>
                            <p className="card-value">{upcomingEventsCount}</p>
                        </div>
                    </div>

                    <div className="gridItem overview-card">
                        <div className="card-text">
                            <p className="card-label">{t('dashboard.promotionsInWallet')}</p>
                            <p className="card-value">{walletPromotionsCount}</p>
                        </div>
                    </div>

                    <div className="gridItem detail-section">
                        <div className="section-header">
                            <h2>{t('dashboard.recentTransactions')}</h2>
                            <a href="/dashboard/transactions" className="view-all-link">{t('dashboard.viewAll')} →</a>
                        </div>
                        <ul className="section-list">
                            {transactionslist.length > 0 ? transactionslist : <EmptyState message={t('dashboard.noRecentTransactions')} />}
                        </ul>
                    </div>

                    <div className="gridItem detail-section">
                        <div className="section-header">
                            <h2>{t('dashboard.upcomingEventsTitle')}</h2>
                            <a href="/dashboard/events" className="view-all-link">{t('dashboard.viewAll')} →</a>
                        </div>
                        <ul className="section-list">
                            {eventlist.length > 0 ? eventlist : <EmptyState message={t('dashboard.noUpcomingEvents')} />}
                        </ul>
                    </div>

                    <div className="gridItem detail-section">
                        <div className="section-header">
                            <h2>{t('dashboard.promotionWallet')}</h2>
                            <a href="/dashboard/promotions" className="view-all-link">{t('dashboard.viewAll')} →</a>
                        </div>
                        <ul className="section-list">
                            {promotionslist.length > 0 ? promotionslist : <EmptyState message={t('dashboard.noPromotionsInWallet')} />}
                        </ul>
                    </div>
                </div>
            )}

            {isCashier && (
                <section className="cashier-tools">
                    <div>
                        <h2>{t('dashboard.cashierQuickAccess')}</h2>
                    </div>
                    <div className="cashier-card-grid">
                        {cashierShortcuts.map((shortcut, index) => (
                            <article key={index} className="cashier-card">
                                <button onClick={() => handleCashierNavigate(shortcut.mode)}>
                                    {shortcut.mode === 'create' ? t('dashboard.createTransaction') : t('dashboard.processRedemption')}
                                </button>
                                <p>{shortcut.mode === 'create' ? t('dashboard.createTransactionDesc') : t('dashboard.processRedemptionDesc')}</p>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {isManagerOrSuperuser && (
                <section className="manager-overview">
                    <div className="gridLayout manager-grid">
                        <div className="gridItem overview-card">
                            <div className="card-text">
                                <p className="card-label">{t('dashboard.upcomingEvents')}</p>
                                <p className="card-value">{upcomingEventsCount}</p>
                                <a href="/dashboard/events" className="view-all-link card-link">{t('dashboard.manageEvents')} →</a>
                            </div>
                        </div>

                        <div className="gridItem overview-card">
                            <div className="card-text">
                                <p className="card-label">{t('dashboard.promotionsInWallet')}</p>
                                <p className="card-value">{walletPromotionsCount}</p>
                                <a href="/dashboard/promotions" className="view-all-link card-link">{t('dashboard.managePromotions')} →</a>
                            </div>
                        </div>

                        <div className="gridItem overview-card">
                            <div className="card-text">
                                <p className="card-label">{t('dashboard.totalUsers')}</p>
                                <p className="card-value">{userSummary.total}</p>
                                <a href="/dashboard/users" className="view-all-link card-link">{t('dashboard.userManagement')} →</a>
                            </div>
                        </div>

                        <div className="gridItem detail-section manager-panel">
                            <div className="section-header">
                                <h2>{t('dashboard.upcomingEventsTitle')}</h2>
                                <a href="/dashboard/events" className="view-all-link">{t('dashboard.seeAllEvents')} →</a>
                            </div>
                            <ul className="section-list">
                                {eventlist.length > 0 ? eventlist : <EmptyState message={t('dashboard.noUpcomingEvents')} />}
                            </ul>
                        </div>

                        <div className="gridItem detail-section manager-panel">
                            <div className="section-header">
                                <h2>{t('dashboard.promotionWallet')}</h2>
                                <a href="/dashboard/promotions" className="view-all-link">{t('dashboard.seeAllPromotions')} →</a>
                            </div>
                            <ul className="section-list">
                                {promotionslist.length > 0 ? promotionslist : <EmptyState message={t('dashboard.noPromotionsInWallet')} />}
                            </ul>
                        </div>

                        <div className="gridItem detail-section manager-panel">
                            <div className="section-header">
                                <h2>{t('dashboard.suspiciousUsers')}</h2>
                                <a href="/dashboard/users" className="view-all-link">{t('dashboard.manageAllUsers')} →</a>
                            </div>
                            {managerError && <Error error={managerError} className="manager-error" />}
                            <ul className="section-list">
                                {flaggedUsersList}
                            </ul>
                        </div>
                    </div>
                </section>
            )}

            {/* Promotion detail popup modal */}
            {/* Opens when user clicks on any promotion card in the "Promotion Wallet" section */}
            <PromotionDetailModal
                promotionId={selectedPromotionId}
                isOpen={promotionModalOpen}
                onClose={() => {
                    setPromotionModalOpen(false);        // Close the modal
                    setSelectedPromotionId(null);     // Clear the selected promotion
                }}
            />
            <EventDetailModal
                eventId={selectedEventId}
                isOpen={eventModalOpen}
                onClose={() => {
                    setEventModalOpen(false);        // Close the modal
                    setSelectedEventId(null);     // Clear the selected promotion
                }}
            />
            <TransactionDetailModal
                transactionId={selectedTransactionId}
                isOpen={transactionModalOpen}
                onClose={() => {
                    setTransactionModalOpen(false);
                    setSelectedTransactionId(null);
                }}
            />
            <UserDetailModal
                userId={selectedUserId}
                isOpen={userModalOpen}
                onClose={() => {
                    setUserModalOpen(false);
                    setSelectedUserId(null);
                }}
                onUserUpdated={() => {
                    // Refresh manager data when user is updated
                    if (refreshManagerData) {
                        refreshManagerData();
                    }
                }}
            />
        </div>
    );
}

export default Dashboard;