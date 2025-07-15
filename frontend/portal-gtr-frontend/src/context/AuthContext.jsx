// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../api'; // Asegúrate de que esta ruta sea correcta

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    // Estado para el token de autenticación
    const [authToken, setAuthToken] = useState(() => {
        // Inicializa el token desde localStorage al cargar la aplicación
        return localStorage.getItem('authToken');
    });
    // Estado para la información del usuario logueado
    const [user, setUser] = useState(null);
    // Estado para indicar si la autenticación está lista (token cargado y usuario verificado)
    const [isAuthReady, setIsAuthReady] = useState(false);
    // Estado para errores de autenticación
    const [authError, setAuthError] = useState(null);

    // Función para iniciar sesión
    const login = useCallback(async (email, password) => {
        setAuthError(null); // Limpiar errores previos
        try {
            const response = await fetch(`${API_BASE_URL}/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    username: email,
                    password: password,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al iniciar sesión.');
            }

            const data = await response.json();
            localStorage.setItem('authToken', data.access_token);
            setAuthToken(data.access_token);
            // Después de obtener el token, cargar la información del usuario
            await fetchUserProfile(data.access_token);
            return true; // Éxito en el login
        } catch (err) {
            console.error("Error en login:", err);
            setAuthError(err.message || 'Error desconocido al iniciar sesión.');
            setAuthToken(null);
            setUser(null);
            localStorage.removeItem('authToken');
            return false; // Fallo en el login
        }
    }, []);

    // Función para cerrar sesión
    const logout = useCallback(() => {
        setAuthToken(null);
        setUser(null);
        localStorage.removeItem('authToken');
        setAuthError(null);
        setIsAuthReady(true); // Considerar la autenticación lista (sin usuario)
    }, []);

    // Función para cargar el perfil del usuario
    const fetchUserProfile = useCallback(async (token) => {
        if (!token) {
            setUser(null);
            setIsAuthReady(true);
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/users/me/`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                // Si el token es inválido o expiró, cerrar sesión
                logout();
                throw new Error("Token inválido o expirado. Por favor, inicie sesión nuevamente.");
            }

            const userData = await response.json();
            setUser(userData);
        } catch (err) {
            console.error("Error al cargar perfil de usuario:", err);
            setAuthError(err.message || "Error al cargar el perfil del usuario.");
            logout(); // Cerrar sesión si hay un error al cargar el perfil
        } finally {
            setIsAuthReady(true);
        }
    }, [logout]);

    // Efecto para cargar el perfil del usuario cuando el componente se monta
    // o cuando el authToken cambia (ej. después de un login/logout)
    useEffect(() => {
        fetchUserProfile(authToken);
    }, [authToken, fetchUserProfile]);

    // Opcional: Si quieres que la aplicación espere a que la autenticación esté lista
    // antes de renderizar el contenido principal.
    if (!isAuthReady) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Cargando autenticación...</span>
                </div>
                <p className="mt-2">Verificando sesión...</p>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ authToken, user, login, logout, authError, isAuthReady }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
