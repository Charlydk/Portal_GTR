// src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { API_BASE_URL } from '../api'; // Asegúrate de que esta ruta sea correcta

// Crea el contexto de autenticación
const AuthContext = createContext(null);

// Proveedor de autenticación que envolverá la aplicación
export const AuthProvider = ({ children }) => {
  // Estado para el token de autenticación
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));
  // Estado para la información del usuario autenticado
  const [user, setUser] = useState(null);
  // Estado para indicar si la autenticación está lista (útil para cargar el usuario inicial)
  const [loading, setLoading] = useState(true);

  // Función para iniciar sesión
  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded', // Importante para OAuth2PasswordRequestForm
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
      localStorage.setItem('authToken', data.access_token); // Guarda el token en localStorage
      setAuthToken(data.access_token); // Actualiza el estado del token
      await fetchUser(data.access_token); // Obtiene la información del usuario
      return true; // Login exitoso
    } catch (error) {
      console.error('Login failed:', error);
      throw error; // Propaga el error para que el componente de login lo maneje
    }
  };

  // Función para cerrar sesión
  const logout = () => {
    localStorage.removeItem('authToken'); // Elimina el token de localStorage
    setAuthToken(null); // Limpia el estado del token
    setUser(null); // Limpia la información del usuario
  };

  // Función para obtener la información del usuario a partir del token
  const fetchUser = async (token) => {
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/users/me/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        logout(); // Si el token es inválido o expiró, cerramos sesión
        throw new Error('Token inválido o expirado. Por favor, inicie sesión de nuevo.');
      }

      const userData = await response.json();
      setUser(userData); // Guarda la información del usuario en el estado
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout(); // En caso de error al obtener el usuario, cierra sesión
    }
  };

  // Efecto para cargar el usuario al iniciar la aplicación (si hay un token guardado)
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      fetchUser(token);
    }
    setLoading(false); // La carga inicial ha terminado
  }, []);

  // Provee el estado y las funciones a los componentes hijos
  return (
    <AuthContext.Provider value={{ authToken, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizado para usar el contexto de autenticación
export const useAuth = () => {
  return useContext(AuthContext);
};
