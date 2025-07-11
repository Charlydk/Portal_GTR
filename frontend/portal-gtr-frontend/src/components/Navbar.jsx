// src/components/Navbar.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar as BSNavbar, Nav, Container, NavDropdown, Button } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext'; // Importa el hook useAuth

function Navbar() {
  const { user, logout } = useAuth(); // Obtiene el usuario y la función de logout del contexto
  const navigate = useNavigate();

  const handleLogout = () => {
    logout(); // Llama a la función de logout del contexto
    navigate('/login'); // Redirige al login después de cerrar sesión
  };

  return (
    <BSNavbar bg="dark" variant="dark" expand="lg" className="mb-4 shadow-sm">
      <Container>
        <BSNavbar.Brand as={Link} to="/dashboard">Portal GTR</BSNavbar.Brand>
        <BSNavbar.Toggle aria-controls="basic-navbar-nav" />
        <BSNavbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            {user && ( // Solo muestra los enlaces si el usuario está autenticado
              <>
                <Nav.Link as={Link} to="/dashboard">Dashboard</Nav.Link>
                <Nav.Link as={Link} to="/tareas">Tareas</Nav.Link>
                <Nav.Link as={Link} to="/campanas">Campañas</Nav.Link>
                <Nav.Link as={Link} to="/avisos">Avisos</Nav.Link>

                {(user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
                  <>
                    <Nav.Link as={Link} to="/analistas">Analistas</Nav.Link>
                    {/* ¡NUEVO ENLACE! */}
                    <Nav.Link as={Link} to="/asignacion-campanas">Asignar Campañas</Nav.Link>
                  </>
                )}
              </>
            )}
          </Nav>
          <Nav>
            {user ? (
              <NavDropdown title={`Hola, ${user.nombre} (${user.role})`} id="basic-nav-dropdown" align="end">
                <NavDropdown.Item as={Link} to={`/analistas/${user.id}`}>Mi Perfil</NavDropdown.Item>
                <NavDropdown.Divider />
                <NavDropdown.Item onClick={handleLogout}>Cerrar Sesión</NavDropdown.Item>
              </NavDropdown>
            ) : (
              <>
                <Nav.Link as={Link} to="/login">Iniciar Sesión</Nav.Link>
                <Nav.Link as={Link} to="/register">Registrarse</Nav.Link>
              </>
            )}
          </Nav>
        </BSNavbar.Collapse>
      </Container>
    </BSNavbar>
  );
}

export default Navbar;
