// src/pages/hhee/PortalHHEEPage.jsx

import React, { useState } from 'react';
import { Container, Form, Button, Card, Spinner, Alert, Table, Row, Col } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { API_BASE_URL } from '../../api';
import ResultadoFila from '../../components/hhee/ResultadoFila';
import { decimalToHHMM, hhmmToDecimal } from '../../utils/timeUtils';


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
                break;
            case 'anterior':
                fechaFin = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 25);
                fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 26);
                break;
            default:
                setFechaInicio(''); setFechaFin(''); return;
        }
        setFechaInicio(formatDate(fechaInicio));
        setFechaFin(formatDate(fechaFin));
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
    const esDescanso = (dia.inicio_turno_teorico === '00:00' && dia.fin_turno_teorico === '00:00');

    initialValidaciones[dia.fecha] = {
        // Usamos los valores calculados de GV para inicializar los inputs
        antes: {
            habilitado: false,
            valor: decimalToHHMM(dia.hhee_inicio_calculadas)
        },
        despues: {
            habilitado: false,
            valor: decimalToHHMM(dia.hhee_fin_calculadas)
        },

        descanso: {
            habilitado: false,
            valor: decimalToHHMM(esDescanso ? dia.cantidad_hhee_calculadas : 0)
        },
        // El resto de la inicialización se queda igual
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

    const handleValidationChange = (fecha, tipo, campo, valor) => {
        setValidaciones(prev => {
            // Hacemos una copia profunda para no mutar el estado directamente
            const newState = JSON.parse(JSON.stringify(prev)); 
    
            // Actualizamos el campo específico (ej: 'habilitado' a true/false o 'valor' a '00:10')
            newState[fecha][tipo][campo] = valor;
    
            // LÓGICA DE RESETEO: Si estamos desmarcando el checkbox...
            if (campo === 'habilitado' && !valor) {
                // ...buscamos los datos originales de ese día para obtener el valor calculado por GV
                const diaData = resultados.find(d => d.fecha === fecha);
                if (diaData) {
                    let valorOriginal = "00:00";
                    if (tipo === 'antes') valorOriginal = decimalToHHMM(diaData.hhee_inicio_calculadas);
                    if (tipo === 'despues') valorOriginal = decimalToHHMM(diaData.hhee_fin_calculadas);
                    if (tipo === 'descanso') valorOriginal = decimalToHHMM(diaData.cantidad_hhee_calculadas);
    
                    // Reseteamos el input a su valor original
                    newState[fecha][tipo]['valor'] = valorOriginal;
                }
            }
            return newState;
        });
    };

    // Función simple para manejar pendiente y nota que no están anidados
    const handleSimpleChange = (fecha, campo, valor) => {
        setValidaciones(prev => ({
            ...prev,
            [fecha]: { ...prev[fecha], [campo]: valor }
        }));
    };

    // --- CAMBIO: LÓGICA DE GUARDADO ADAPTADA A LA NUEVA ESTRUCTURA ---
    const handleGuardar = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
    
        const validacionesParaEnviar = resultados
            .map(dia => {
                const validacion = validaciones[dia.fecha];
                if (!validacion) return null;
    
                // CORRECCIÓN: Ahora también incluimos las filas que han sido re-validadas
                const debeEnviar = validacion.antes?.habilitado || 
                                 validacion.despues?.habilitado || 
                                 validacion.descanso?.habilitado || 
                                 validacion.pendiente ||
                                 validacion.revalidado; // <-- AÑADIMOS LA CONDICIÓN
    
                if (!debeEnviar) return null;
    
                return {
                    rut_con_formato: rut,
                    fecha: dia.fecha,
                    nombre_apellido: nombreAgente,
                    campaña: dia.campaña,
                    turno_es_incorrecto: validacion.pendiente,
                    nota: validacion.nota,
                    hhee_aprobadas_inicio: validacion.antes.habilitado ? hhmmToDecimal(validacion.antes.valor) : 0,
                    hhee_aprobadas_fin: validacion.despues.habilitado ? hhmmToDecimal(validacion.despues.valor) : 0,
                    hhee_aprobadas_descanso: validacion.descanso.habilitado ? hhmmToDecimal(validacion.descanso.valor) : 0,
                };
            })
            .filter(Boolean); // Filtra los nulos
    
        // Ahora esta comprobación funcionará correctamente para el caso de "cancelar pendiente"
        if (validacionesParaEnviar.length === 0) {
            setError("No has habilitado ninguna fila para guardar o re-validar.");
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
            handleConsulta({ preventDefault: () => {} });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    
    const handleRevalidar = (rut, fecha) => {
        const diaParaRevalidar = resultados.find(d => d.fecha === fecha);
        if (!diaParaRevalidar) return;
    
        // Cambiamos el estado visual de la tabla
        setResultados(prevResultados => 
            prevResultados.map(dia => 
                dia.fecha === fecha ? { ...dia, estado_final: 'No Guardado', notas: '' } : dia
            )
        );
    
        // Reseteamos el estado de los inputs para esa fila y añadimos la bandera
        setValidaciones(prevValidaciones => ({
            ...prevValidaciones,
            [fecha]: {
                antes: {
                    habilitado: false,
                    valor: decimalToHHMM(diaParaRevalidar.hhee_inicio_calculadas)
                },
                despues: {
                    habilitado: false,
                    valor: decimalToHHMM(diaParaRevalidar.hhee_fin_calculadas)
                },
                descanso: {
                    habilitado: false,
                    valor: decimalToHHMM(diaParaRevalidar.cantidad_hhee_calculadas)
                },
                pendiente: false,
                nota: '',
                revalidado: true
            }
        }));
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
            
            {loading && <div className="text-center"><Spinner animation="border" /> <p>Cargando...</p></div>}
            {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
            {success && <Alert variant="success" onClose={() => setSuccess(null)} dismissible>{success}</Alert>}
    
            {resultados.length > 0 && (
                <Card className="shadow-sm">
                    <Card.Header className="d-flex justify-content-between align-items-center">
                        <h4>Resultados para: {nombreAgente}</h4>
                        <Button variant="success" onClick={handleGuardar} disabled={loading}>
                            Guardar Validaciones
                        </Button>
                    </Card.Header>
                    <Card.Body>
                    <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Turno / Marcas</th>
                            <th>HHEE a Aprobar</th>
                            <th>HHEE Aprobadas (RRHH)</th>
                            <th>Marcar como Pendiente</th>
                        </tr>
                    </thead>
                    <tbody>
                        {resultados.map((dia) => (
                            <ResultadoFila
                                key={dia.fecha}
                                dia={dia}
                                validacionDia={validaciones[dia.fecha]}
                                onValidationChange={handleValidationChange}
                                onSimpleChange={handleSimpleChange}
                                onRevalidar={handleRevalidar} // <-- PASAMOS LA FUNCIÓN AQUÍ
                            />
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