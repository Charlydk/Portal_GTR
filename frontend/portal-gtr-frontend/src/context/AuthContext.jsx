// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { API_BASE_URL } from '../api'; // Asegúrate de que API_BASE_URL esté definido

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));
    const [loading, setLoading] = useState(true); // Estado de carga para la autenticación inicial

    // Función para obtener el perfil del usuario
    const fetchUserProfile = useCallback(async (token) => {
        if (!token) {
            setUser(null);
            setLoading(false);
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/users/me/`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const userData = await response.json();
                setUser(userData);
            } else {
                // Si el token no es válido o hay un error, limpiar sesión
                console.error("Error al obtener el perfil del usuario:", response.statusText);
                localStorage.removeItem('authToken');
                setAuthToken(null);
                setUser(null);
            }
        } catch (error) {
            console.error("Error de red o inesperado al obtener el perfil:", error);
            localStorage.removeItem('authToken');
            setAuthToken(null);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    // Función para refrescar el perfil del usuario (útil después de ciertas operaciones)
    const refreshUser = useCallback(async () => {
        if (authToken) {
            await fetchUserProfile(authToken);
        }
    }, [authToken, fetchUserProfile]);

    useEffect(() => {
        // Al cargar la aplicación, intentar obtener el perfil si hay un token
        if (authToken) {
            fetchUserProfile(authToken);
        } else {
            setLoading(false); // No hay token, no hay usuario, terminar carga
        }
    }, [authToken, fetchUserProfile]);

    // Función de login
    const login = async (email, password) => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({ username: email, password: password }).toString(),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error en el inicio de sesión');
            }

            const data = await response.json();
            localStorage.setItem('authToken', data.access_token);
            setAuthToken(data.access_token);
            // El useEffect se encargará de llamar a fetchUserProfile con el nuevo token
            return { success: true };
        } catch (error) {
            console.error("Error de login:", error);
            setError(error.message); // Establecer el error para mostrarlo en el componente de login
            setLoading(false);
            return { success: false, error: error.message };
        }
    };

    // Función de logout
    const logout = () => {
        localStorage.removeItem('authToken');
        setAuthToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, authToken, loading, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
