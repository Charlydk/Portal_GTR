// src/pages/hhee/PortalHHEEPage.jsx

import React, { useState } from 'react';
import { Container, Form, Button, Card, Spinner, Alert, Table } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../api';

function PortalHHEEPage() {
    // Estados para el formulario
    const [rut, setRut] = useState('');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');

    // Estados para la respuesta de la API
    const [resultados, setResultados] = useState([]);
    const [nombreAgente, setNombreAgente] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const { authToken } = useAuth();

    const handleConsulta = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResultados([]);
        setNombreAgente('');

        try {
            const response = await fetch(`${API_BASE_URL}/hhee/consultar-empleado`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    rut: rut,
                    fecha_inicio: fechaInicio,
                    fecha_fin: fechaFin
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Ocurrió un error en la consulta.');
            }

            setNombreAgente(data.nombre_agente);
            setResultados(data.datos_periodo);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container className="py-4">
            <h1 className="mb-4">Portal de Carga de Horas Extras (HHEE)</h1>
            
            <Card className="shadow-sm mb-4">
                <Card.Body>
                    <Card.Title>Consultar Período de Empleado</Card.Title>
                    <Form onSubmit={handleConsulta}>
                        {/* ... (Tu formulario se queda igual) ... */}
                        <Form.Group className="mb-3" controlId="rut-consulta">
                            <Form.Label>RUT del Empleado</Form.Label>
                            <Form.Control type="text" placeholder="Ej: 12345678-9" value={rut} onChange={(e) => setRut(e.target.value)} required />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="fecha-inicio">
                            <Form.Label>Fecha de Inicio</Form.Label>
                            <Form.Control type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="fecha-fin">
                            <Form.Label>Fecha de Fin</Form.Label>
                            <Form.Control type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} required />
                        </Form.Group>
                        <Button variant="primary" type="submit" disabled={loading}>
                            {loading ? <Spinner as="span" animation="border" size="sm" /> : 'Consultar'}
                        </Button>
                    </Form>
                </Card.Body>
            </Card>

            {/* --- SECCIÓN DE RESULTADOS --- */}
            {loading && <div className="text-center"><Spinner animation="border" /> <p>Consultando...</p></div>}
            
            {error && <Alert variant="danger">{error}</Alert>}

            {resultados.length > 0 && (
                <Card className="shadow-sm">
                    <Card.Header>
                        <h4>Resultados para: {nombreAgente}</h4>
                    </Card.Header>
                    <Card.Body>
                        <Table striped bordered hover responsive>
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Turno Teórico</th>
                                    <th>Marcas Reales</th>
                                    <th>Estado Guardado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resultados.map((dia, index) => (
                                    <tr key={index}>
                                        <td>{dia.fecha}</td>
                                        <td>{dia.inicio_turno_teorico} - {dia.fin_turno_teorico}</td>
                                        <td>{dia.marca_real_inicio || 'N/A'} - {dia.marca_real_fin || 'N/A'}</td>
                                        <td>{dia.estado_final}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </Card.Body>
                </Card>
            )}
        </Container>
    );
}

export default PortalHHEEPage;