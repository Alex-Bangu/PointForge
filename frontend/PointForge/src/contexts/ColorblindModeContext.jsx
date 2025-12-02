import { createContext, useContext, useState, useEffect } from 'react';

export const ColorblindModeContext = createContext({
    colorblindMode: 'none',
    setColorblindMode: () => {},
});

const COLORBLIND_MODES = {
    none: {
        name: 'none',
        filter: 'none',
    },
    protanopia: {
        name: 'protanopia',
        filter: 'url(#protanopia)',
    },
    deuteranopia: {
        name: 'deuteranopia',
        filter: 'url(#deuteranopia)',
    },
    tritanopia: {
        name: 'tritanopia',
        filter: 'url(#tritanopia)',
    },
    achromatopsia: {
        name: 'achromatopsia',
        filter: 'url(#achromatopsia)',
    },
};

export function ColorblindModeProvider({ children }) {
    const [colorblindMode, setColorblindModeState] = useState(() => {
        return localStorage.getItem('colorblindMode') || 'none';
    });

    useEffect(() => {
        localStorage.setItem('colorblindMode', colorblindMode);
        applyColorblindMode(colorblindMode);
    }, [colorblindMode]);

    const applyColorblindMode = (mode) => {
        const root = document.documentElement;
        
        // Remove existing filter class
        root.classList.remove('colorblind-protanopia', 'colorblind-deuteranopia', 
                             'colorblind-tritanopia', 'colorblind-achromatopsia');
        
        if (mode !== 'none') {
            root.classList.add(`colorblind-${mode}`);
        }
    };

    const setColorblindMode = (mode) => {
        setColorblindModeState(mode);
    };

    return (
        <ColorblindModeContext.Provider value={{ colorblindMode, setColorblindMode }}>
            {children}
        </ColorblindModeContext.Provider>
    );
}

export const useColorblindMode = () => {
    const context = useContext(ColorblindModeContext);
    if (!context) {
        throw new Error('useColorblindMode must be used within a ColorblindModeProvider');
    }
    return context;
};

