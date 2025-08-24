// src/pages/hhee/PortalHHEEPage.jsx

import React, { useState } from 'react';
import { Container, Form, Button, Card, Spinner, Alert, Table, Row, Col } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../api';

function PortalHHEEPage() {
    const [rut, setRut] = useState('');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [resultados, setResultados] = useState([]);
    const [nombreAgente, setNombreAgente] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [validaciones, setValidaciones] = useState({});
    const { authToken } = useAuth();

    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    const handlePeriodoChange = (seleccion) => {
        let fechaInicio, fechaFin;
        const hoy = new Date();
    
        switch (seleccion) {
            case 'actual':
                fechaFin = new Date(hoy.getFullYear(), hoy.getMonth(), 25);
                fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 26);
                setFechaInicio(formatDate(fechaInicio));
                setFechaFin(formatDate(fechaFin));
                break;
            case 'anterior':
                fechaFin = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 25);
                fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 26);
                setFechaInicio(formatDate(fechaInicio));
                setFechaFin(formatDate(fechaFin));
                break;
            default:
                setFechaInicio('');
                setFechaFin('');
                break;
        }
    };

    const handleConsulta = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);
        setResultados([]);
        setNombreAgente('');
        setValidaciones({});

        try {
            const response = await fetch(`${API_BASE_URL}/hhee/consultar-empleado`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ rut, fecha_inicio: fechaInicio, fecha_fin: fechaFin })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail);

            setNombreAgente(data.nombre_agente);
            setResultados(data.datos_periodo);

            const initialValidaciones = {};
            data.datos_periodo.forEach(dia => {
                initialValidaciones[dia.fecha] = {
                    habilitado: false,
                    hhee_aprobadas: dia.hhee_autorizadas_despues_gv || 0,
                    pendiente: dia.estado_final === 'Pendiente por Corrección',
                    nota: dia.notas || ''
                };
            });
            setValidaciones(initialValidaciones);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleValidationChange = (fecha, campo, valor) => {
        setValidaciones(prev => ({
            ...prev,
            [fecha]: {
                ...prev[fecha],
                [campo]: valor
            }
        }));
    };

    const handleGuardar = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        const validacionesParaEnviar = resultados
            .filter(dia => validaciones[dia.fecha]?.habilitado)
            .map(dia => {
                const validacion = validaciones[dia.fecha];
                return {
                    rut_con_formato: rut,
                    fecha: dia.fecha,
                    nombre_apellido: nombreAgente,
                    campaña: dia.campaña,
                    turno_es_incorrecto: validacion.pendiente,
                    nota: validacion.nota,
                    hhee_aprobadas_inicio: 0,
                    hhee_aprobadas_fin: validacion.hhee_aprobadas,
                    hhee_aprobadas_descanso: 0,
                };
            });

        if (validacionesParaEnviar.length === 0) {
            setError("No has habilitado ninguna fila para guardar. Marca la casilla 'Habilitar' en las filas que quieras guardar.");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/hhee/cargar-hhee`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ validaciones: validacionesParaEnviar })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail);

            setSuccess(data.mensaje);
            const fakeEvent = { preventDefault: () => {} };
            handleConsulta(fakeEvent);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCargarPendientes = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        setResultados([]);
    
        try {
            const response = await fetch(`${API_BASE_URL}/hhee/pendientes`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail);
    
            if (!data.datos_periodo || data.datos_periodo.length === 0) {
                setSuccess('¡Excelente! No hay registros pendientes por corregir.');
                return;
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
            
            {/* --- ESTE ES EL BLOQUE CORREGIDO --- */}
            <Card className="shadow-sm mb-4">
                <Card.Body>
                    <Card.Title>Consultar Período de Empleado</Card.Title>
                    <Form onSubmit={handleConsulta}>
                        <Row className="align-items-end g-3 mb-3">
                            <Col md={3}>
                                <Form.Group controlId="rut-consulta">
                                    <Form.Label>RUT del Empleado</Form.Label>
                                    <Form.Control 
                                        type="text" 
                                        placeholder="Ej: 12345678-9" 
                                        value={rut} 
                                        onChange={(e) => setRut(e.target.value)} 
                                        required 
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={3}>
                                <Form.Group controlId="fecha-inicio">
                                    <Form.Label>Fecha de Inicio</Form.Label>
                                    <Form.Control 
                                        type="date" 
                                        value={fechaInicio} 
                                        onChange={(e) => setFechaInicio(e.target.value)} 
                                        required 
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={3}>
                                <Form.Group controlId="fecha-fin">
                                    <Form.Label>Fecha de Fin</Form.Label>
                                    <Form.Control 
                                        type="date" 
                                        value={fechaFin} 
                                        onChange={(e) => setFechaFin(e.target.value)} 
                                        required 
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={3}>
                                <Form.Group controlId="select-periodo">
                                    <Form.Label>Período Rápido</Form.Label>
                                    <Form.Select onChange={(e) => handlePeriodoChange(e.target.value)}>
                                        <option value="">Seleccionar...</option>
                                        <option value="actual">Periodo actual</option>
                                        <option value="anterior">Periodo anterior (-1)</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row>
                            <Col>
                                <Button variant="primary" type="submit" disabled={loading} className="me-2">
                                    {loading ? <Spinner as="span" animation="border" size="sm" /> : 'Consultar'}
                                </Button>
                                <Button variant="warning" type="button" onClick={handleCargarPendientes} disabled={loading}>
                                    Mostrar Pendientes
                                </Button>
                            </Col>
                        </Row>
                    </Form>
                </Card.Body>
            </Card>
            {/* --- FIN DEL BLOQUE CORREGIDO --- */}

            {loading && <div className="text-center"><Spinner animation="border" /> <p>Cargando...</p></div>}
            {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
            {success && <Alert variant="success" onClose={() => setSuccess(null)} dismissible>{success}</Alert>}

            {resultados.length > 0 && (
                <Card className="shadow-sm">
                    <Card.Header className="d-flex justify-content-between align-items-center">
                        <h4>Resultados para: {nombreAgente}</h4>
                        <Button variant="success" onClick={handleGuardar} disabled={loading}>
                            Guardar Validaciones Habilitadas
                        </Button>
                    </Card.Header>
                    <Card.Body>
                        <Table striped bordered hover responsive>
                            <thead>
                                <tr>
                                    <th>Habilitar</th>
                                    <th>Fecha</th>
                                    <th>Marcas (Real)</th>
                                    <th>HHEE (RRHH)</th>
                                    <th>HHEE a Aprobar</th>
                                    <th>Marcar Pendiente</th>
                                    <th>Estado Actual</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resultados.map((dia) => (
                                    <tr key={dia.fecha}>
                                        <td>
                                            <Form.Check 
                                                type="checkbox"
                                                checked={validaciones[dia.fecha]?.habilitado || false}
                                                onChange={(e) => handleValidationChange(dia.fecha, 'habilitado', e.target.checked)}
                                            />
                                        </td>
                                        <td>{dia.fecha}</td>
                                        <td>{dia.marca_real_inicio || 'N/A'} - {dia.marca_real_fin || 'N/A'}</td>
                                        <td>{(dia.hhee_autorizadas_despues_gv || 0).toFixed(2)} hrs</td>
                                        <td>
                                            <Form.Control 
                                                type="number"
                                                step="0.01"
                                                value={validaciones[dia.fecha]?.hhee_aprobadas || 0}
                                                onChange={(e) => handleValidationChange(dia.fecha, 'hhee_aprobadas', parseFloat(e.target.value))}
                                                disabled={!validaciones[dia.fecha]?.habilitado || validaciones[dia.fecha]?.pendiente}
                                                style={{ width: '80px' }}
                                            />
                                        </td>
                                        <td>
                                            <Form.Check 
                                                type="checkbox"
                                                label="Sí"
                                                checked={validaciones[dia.fecha]?.pendiente || false}
                                                onChange={(e) => handleValidationChange(dia.fecha, 'pendiente', e.target.checked)}
                                                disabled={!validaciones[dia.fecha]?.habilitado}
                                            />
                                        </td>
                                        <td>
                                            <span className={`badge bg-${dia.estado_final === 'Validado' ? 'success' : dia.estado_final === 'Pendiente por Corrección' ? 'warning' : 'secondary'}`}>
                                                {dia.estado_final}
                                            </span>
                                        </td>
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