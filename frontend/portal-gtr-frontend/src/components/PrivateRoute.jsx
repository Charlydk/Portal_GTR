// src/components/PrivateRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Importa useAuth

/**
 * Componente de Ruta Privada para proteger rutas basadas en autenticación y roles.
 *
 * @param {object} props - Las propiedades del componente.
 * @param {Array<string>} props.allowedRoles - Un array de roles permitidos para acceder a esta ruta (ej. ['ANALISTA', 'SUPERVISOR']).
 * @param {React.ReactNode} props.children - Los componentes hijos que se renderizarán si el acceso es permitido.
 * @returns {React.ReactNode} Los componentes hijos si el usuario está autenticado y tiene el rol permitido,
 * o un componente Navigate a la página de login si no lo está.
 */
function PrivateRoute({ children, allowedRoles }) {
    const { user, isAuthReady } = useAuth(); // Obtiene el usuario y el estado de autenticación

    // Si la autenticación aún no está lista, no renderizar nada (o un spinner si lo prefieres en App.jsx)
    if (!isAuthReady) {
        return null; // O un spinner de carga global si lo manejas en App.jsx
    }

    // Si no hay usuario o el usuario no tiene un rol, redirigir a login
    if (!user || !user.role) {
        return <Navigate to="/login" replace />;
    }

    // Si se especifican roles permitidos, verificar si el rol del usuario está en esa lista
    if (allowedRoles && allowedRoles.length > 0) {
        if (!allowedRoles.includes(user.role)) {
            // Si el usuario no tiene el rol permitido, redirigir a una página de acceso denegado o a la home
            // console.warn(`Acceso denegado para el rol ${user.role} en esta ruta.`);
            // Podrías redirigir a una página de "Acceso Denegado"
            return <Navigate to="/" replace />; // Redirigir a la página de inicio por defecto
        }
    }

    // Si todo está bien, renderizar los componentes hijos
    return children;
}

export default PrivateRoute;
