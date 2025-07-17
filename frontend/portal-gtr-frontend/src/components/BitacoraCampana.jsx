// src/components/BitacoraCampana.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Button, Form, Table, Spinner, Alert } from 'react-bootstrap';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';

function BitacoraCampana({ campanaId, initialGeneralComment }) { // initialBitacoraEntries ya no es necesario aquí
    const { authToken, user } = useAuth();
    const [bitacoraEntries, setBitacoraEntries] = useState([]);
    const [generalComment, setGeneralComment] = useState('');
    const [editingEntryId, setEditingEntryId] = useState(null);
    const [currentEntryComment, setCurrentEntryComment] = useState('');
    const [currentGeneralComment, setCurrentGeneralComment] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [loadingEntries, setLoadingEntries] = useState(true); // Nuevo estado de carga para las entradas
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Estado para la fecha seleccionada, inicializado a hoy
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // Formato YYYY-MM-DD

    // Generar las franjas horarias de 00:00 a 23:30 en intervalos de 30 minutos
    const generateTimeSlots = useCallback(() => {
        const slots = [];
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 30) {
                const hour = String(h).padStart(2, '0');
                const minute = String(m).padStart(2, '0');
                slots.push(`${hour}:${minute}`);
            }
        }
        return slots;
    }, []);

    const timeSlots = generateTimeSlots();

    // Función para cargar las entradas de bitácora para la fecha seleccionada
    const fetchBitacoraEntries = useCallback(async () => {
        if (!authToken || !user || !campanaId || !selectedDate) {
            setLoadingEntries(false);
            return;
        }

        setLoadingEntries(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/campanas/${campanaId}/bitacora?fecha=${selectedDate}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Error al cargar entradas de bitácora: ${response.statusText}`);
            }

            const data = await response.json();
            setBitacoraEntries(data);
        } catch (err) {
            console.error("Error al cargar entradas de bitácora:", err);
            setError(err.message || "No se pudieron cargar las entradas de bitácora para esta fecha.");
        } finally {
            setLoadingEntries(false);
        }
    }, [authToken, user, campanaId, selectedDate]);

    // Efecto para cargar las entradas de bitácora cuando cambian las dependencias
    useEffect(() => {
        fetchBitacoraEntries();
    }, [fetchBitacoraEntries]);

    // Efecto para inicializar el comentario general
    useEffect(() => {
        if (initialGeneralComment) {
            setGeneralComment(initialGeneralComment.comentario || '');
            setCurrentGeneralComment(initialGeneralComment.comentario || '');
        }
    }, [initialGeneralComment]);

    // Función para manejar la edición de una entrada de bitácora
    const handleEditEntry = (entry) => {
        // Usamos una combinación de ID y hora para la clave de edición,
        // o 'new' + hora para nuevas entradas que aún no tienen ID
        setEditingEntryId(entry ? entry.id : `new-${selectedDate}-${entry.hora}`);
        setCurrentEntryComment(entry ? entry.comentario : '');
    };

    // Función para cancelar la edición
    const handleCancelEdit = () => {
        setEditingEntryId(null);
        setCurrentEntryComment('');
    };

    // Función para guardar una entrada de bitácora
    const handleSaveEntry = async (hora) => {
        if (!authToken || !user || isSaving) return;

        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        const existingEntry = bitacoraEntries.find(entry => entry.hora === hora);
        const method = existingEntry ? 'PUT' : 'POST';
        const url = existingEntry ? `${API_BASE_URL}/bitacora_entries/${existingEntry.id}` : `${API_BASE_URL}/bitacora_entries/`;
        
        const payload = {
            campana_id: campanaId,
            fecha: selectedDate, // ¡Ahora enviamos la fecha!
            hora: hora,
            comentario: currentEntryComment
        };

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Error al guardar la entrada de bitácora: ${response.statusText}`);
            }

            const savedEntry = await response.json();
            
            // Refrescar las entradas después de guardar
            await fetchBitacoraEntries();
            
            handleCancelEdit(); // Salir del modo edición
            setSuccessMessage("Entrada de bitácora guardada con éxito.");

        } catch (err) {
            console.error("Error al guardar entrada de bitácora:", err);
            setError(err.message || "No se pudo guardar la entrada de bitácora.");
        } finally {
            setIsSaving(false);
            setTimeout(() => { setSuccessMessage(null); setError(null); }, 5000);
        }
    };

    // Función para eliminar una entrada de bitácora
    const handleDeleteEntry = async (entryId) => {
        if (!authToken || !user || isSaving) return;

        if (!window.confirm("¿Está seguro de que desea eliminar esta entrada de bitácora?")) {
            return;
        }

        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await fetch(`${API_BASE_URL}/bitacora_entries/${entryId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Error al eliminar la entrada de bitácora: ${response.statusText}`);
            }

            // Refrescar las entradas después de eliminar
            await fetchBitacoraEntries();
            setSuccessMessage("Entrada de bitácora eliminada con éxito.");

        } catch (err) {
            console.error("Error al eliminar entrada de bitácora:", err);
            setError(err.message || "No se pudo eliminar la entrada de bitácora.");
        } finally {
            setIsSaving(false);
            setTimeout(() => { setSuccessMessage(null); setError(null); }, 5000);
        }
    };

    // Función para guardar el comentario general
    const handleSaveGeneralComment = async () => {
        if (!authToken || !user || isSaving) return;

        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        const url = `${API_BASE_URL}/campanas/${campanaId}/bitacora_general_comment`;
        const payload = {
            campana_id: campanaId,
            comentario: currentGeneralComment
        };

        try {
            const response = await fetch(url, {
                method: 'PUT', // Siempre PUT para upsert
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Error al guardar el comentario general: ${response.statusText}`);
            }

            const savedComment = await response.json();
            setGeneralComment(savedComment.comentario); // Actualizar el estado del comentario general
            setSuccessMessage("Comentario general guardado con éxito.");

        } catch (err) {
            console.error("Error al guardar comentario general:", err);
            setError(err.message || "No se pudo guardar el comentario general.");
        } finally {
            setIsSaving(false);
            setTimeout(() => { setSuccessMessage(null); setError(null); }, 5000);
        }
    };

    // Determinar permisos para editar entradas de bitácora (cualquier rol puede editar sus propias asignadas campañas)
    const canEditBitacoraEntry = user && (user.role === 'ANALISTA' || user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE');
    // Determinar permisos para editar el comentario general (solo Supervisor o Responsable)
    const canEditGeneralComment = user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE');

    return (
        <div className="mt-4">
            {error && <Alert variant="danger">{error}</Alert>}
            {successMessage && <Alert variant="success">{successMessage}</Alert>}

            <h4>Bitácora Diaria</h4>
            <Form.Group className="mb-3">
                <Form.Label>Seleccionar Fecha:</Form.Label>
                <Form.Control
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    disabled={isSaving}
                />
            </Form.Group>

            {loadingEntries ? (
                <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Cargando entradas de bitácora...</span>
                    </Spinner>
                </div>
            ) : (
                <Table striped bordered hover responsive className="mb-5">
                    <thead>
                        <tr>
                            <th className="w-25">Hora</th>
                            <th>Comentario</th>
                            <th className="w-25">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {timeSlots.map(slot => {
                            const entry = bitacoraEntries.find(e => e.hora === slot);
                            // La clave de edición ahora debe incluir la fecha para nuevas entradas
                            const isCurrentlyEditing = editingEntryId === (entry ? entry.id : `new-${selectedDate}-${slot}`);

                            return (
                                <tr key={slot}>
                                    <td>{slot}</td>
                                    <td>
                                        {isCurrentlyEditing ? (
                                            <Form.Control
                                                as="textarea"
                                                rows={2}
                                                value={currentEntryComment}
                                                onChange={(e) => setCurrentEntryComment(e.target.value)}
                                                disabled={isSaving}
                                            />
                                        ) : (
                                            entry?.comentario || '(Sin comentario)'
                                        )}
                                    </td>
                                    <td>
                                        {canEditBitacoraEntry && (
                                            isCurrentlyEditing ? (
                                                <>
                                                    <Button
                                                        variant="success"
                                                        size="sm"
                                                        onClick={() => handleSaveEntry(slot)}
                                                        disabled={isSaving}
                                                        className="me-2"
                                                    >
                                                        {isSaving ? <Spinner as="span" animation="border" size="sm" /> : 'Guardar'}
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={handleCancelEdit}
                                                        disabled={isSaving}
                                                    >
                                                        Cancelar
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button
                                                        variant="info"
                                                        size="sm"
                                                        onClick={() => handleEditEntry(entry || { hora: slot, comentario: '' })}
                                                        disabled={isSaving}
                                                        className="me-2"
                                                    >
                                                        {entry ? 'Editar' : 'Añadir'}
                                                    </Button>
                                                    {entry && (
                                                        <Button
                                                            variant="danger"
                                                            size="sm"
                                                            onClick={() => handleDeleteEntry(entry.id)}
                                                            disabled={isSaving}
                                                        >
                                                            Eliminar
                                                        </Button>
                                                    )}
                                                </>
                                            )
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </Table>
            )}

            <h4 className="mt-5">Comentario General de la Campana</h4>
            <Form.Group className="mb-3">
                <Form.Label>Comentario General</Form.Label>
                <Form.Control
                    as="textarea"
                    rows={4}
                    value={currentGeneralComment}
                    onChange={(e) => setCurrentGeneralComment(e.target.value)}
                    disabled={!canEditGeneralComment || isSaving}
                    placeholder="Ingrese un comentario general para esta campaña..."
                />
            </Form.Group>
            {canEditGeneralComment && (
                <Button variant="primary" onClick={handleSaveGeneralComment} disabled={isSaving}>
                    {isSaving ? <Spinner as="span" animation="border" size="sm" /> : 'Guardar Comentario General'}
                </Button>
            )}
        </div>
    );
}

export default BitacoraCampana;
