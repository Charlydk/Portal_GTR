// src/components/Navbar.jsx

import React from 'react';
import { Link } from 'react-router-dom'; // <-- Importa Link

function Navbar() {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container-fluid">
        {/* Usa Link en lugar de a para el brand también si lo quieres */}
        <Link className="navbar-brand" to="/">Portal GTR</Link> {/* 'to' en lugar de 'href' */}
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
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <Link className="nav-link active" aria-current="page" to="/">Inicio</Link> {/* Cambiado a Link */}
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/campanas">Campañas</Link> {/* Cambiado a Link */}
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/tareas">Tareas</Link> {/* Cambiado a Link */}
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/analistas">Analistas</Link> {/* Nueva ruta */}
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/avisos">Avisos</Link> {/* Cambiado a Link */}
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/configuracion">Configuración</Link> {/* Nueva ruta, puedes crear esta página después */}
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;