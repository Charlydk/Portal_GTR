// src/components/Navbar.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Importa el hook de autenticación

function Navbar() {
  const { user, logout } = useAuth(); // Obtiene el usuario y la función de logout del contexto

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container-fluid">
        <Link className="navbar-brand" to="/">Portal GTR</Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <Link className="nav-link" to="/analistas">Analistas</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/campanas">Campañas</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/tareas">Tareas</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/avisos">Avisos</Link>
            </li>
            {/* Puedes añadir más enlaces aquí si es necesario */}
          </ul>
          <ul className="navbar-nav">
            {user ? (
              <>
                <li className="nav-item">
                  <span className="nav-link text-white">Hola, {user.nombre} ({user.role})</span>
                </li>
                <li className="nav-item">
                  <button className="btn btn-outline-light ms-2" onClick={logout}>
                    Cerrar Sesión
                  </button>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/login">Iniciar Sesión</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/register">Registrarse</Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
