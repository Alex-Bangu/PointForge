import './App.css'

import Reset from "./pages/reset.jsx";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Account from './pages/account';
import Dashboard from './pages/dashboard';
import Events from './pages/events';
import Login from './pages/login';
import Promotions from './pages/promotions';
import Transactions from './pages/transactions';
import QRCode from './pages/qrcode';
import Redemption from './pages/redemption';
import RedemptionQR from './pages/redemption-qr';
import CashierCreatePurchase from './pages/cashierCreatePurchase.jsx';
import CashierProcessRedemption from './pages/cashierProcessRedemption.jsx';
import ManagerCreateAdjustment from './pages/managerCreateAdjustment.jsx';
import TransferPoints from './pages/transferPoints.jsx';
import { LoginLayout, DashboardLayout } from "./components";
import Register from "./pages/register.jsx";
import Forgot from "./pages/forgot.jsx";
import Users from "./pages/users.jsx";
import { UserProvider } from "./contexts/UserContext.jsx";
import { LanguageProvider } from "./contexts/LanguageContext.jsx";
import { ColorblindModeProvider } from "./contexts/ColorblindModeContext.jsx";
import { InterfaceViewProvider } from "./contexts/InterfaceViewContext.jsx";


function App() {
    return (
        <BrowserRouter>
            <LanguageProvider>
                <ColorblindModeProvider>
                    <UserProvider>
                        <InterfaceViewProvider>
                        <Routes>
                    <Route path="/" element={<Navigate to="/login" replace/>}/>
                    <Route path="/login" element={<LoginLayout/>}>
                        <Route index element={<Login/>}/>
                        <Route path="register" element={<Register/>}/>
                        <Route path="forgot" element={<Forgot/>}/>
                        <Route path=":resetId" element={<Reset/>}/>
                    </Route>
                    <Route path="/dashboard" element={<DashboardLayout/>}>
                        <Route index element={<Dashboard/>}/>
                        <Route path="account" element={<Account/>}/>
                        <Route path="events" element={<Events/>}/>
                        <Route path="promotions" element={<Promotions/>}/>
                        <Route path="transactions" element={<Transactions/>}/>
                        <Route path="users" element={<Users/>}/>
                        <Route path="qrcode" element={<QRCode/>}/>
                        <Route path="redemption" element={<Redemption/>}/>
                        <Route path="redemption-qr/:transactionId?" element={<RedemptionQR/>}/>
                        <Route path="cashier/create-purchase" element={<CashierCreatePurchase/>}/>
                        <Route path="cashier/process-redemption" element={<CashierProcessRedemption/>}/>
                        <Route path="manager/create-adjustment" element={<ManagerCreateAdjustment/>}/>
                        <Route path="transfer" element={<TransferPoints/>}/>
                    </Route>
                </Routes>
                        </InterfaceViewProvider>
                    </UserProvider>
                </ColorblindModeProvider>
            </LanguageProvider>
        </BrowserRouter>
    );
}


export default App
