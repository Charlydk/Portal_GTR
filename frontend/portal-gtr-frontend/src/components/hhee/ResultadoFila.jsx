// src/components/hhee/ResultadoFila.jsx

import React from 'react';
import { Form } from 'react-bootstrap';
import { decimalToHHMM } from '../../utils/timeUtils';


// El componente recibe todas las props que necesita para renderizar una fila
function ResultadoFila({ dia, validacionDia, onValidationChange, onSimpleChange, onRevalidar }) {

    const esDescanso = (dia.inicio_turno_teorico === '00:00' && dia.fin_turno_teorico === '00:00') || dia.tipo_hhee === 'Día de Descanso';
    const isDisabled = validacionDia.pendiente;

    // --- Lógica para la celda de HHEE a Aprobar ---
    const renderInputsHHEE = () => {
        if (dia.estado_final === 'Validado') {
            // Si ya está validado, mostramos texto simple
            const hheeAprobadas = dia.cantidad_hhee_aprobadas || (dia.hhee_aprobadas_inicio + dia.hhee_aprobadas_fin + dia.hhee_aprobadas_descanso);
            return <div className="texto-aprobado">Aprobado: {decimalToHHMM(hheeAprobadas)}</div>;
        }
        if (dia.estado_final === 'Pendiente por Corrección') {
            return <div style={{ color: 'orange' }}>Pendiente</div>;
        }

        if (esDescanso) {
            return (
                <div className="d-flex align-items-center">
                    <Form.Check type="checkbox" className="me-2" checked={validacionDia.descanso?.habilitado} disabled={isDisabled} onChange={e => onValidationChange(dia.fecha, 'descanso', 'habilitado', e.target.checked)} />
                    <Form.Label className="me-2 mb-0 fw-bold">Descanso:</Form.Label>
                    <Form.Control type="time" style={{ width: '100px' }} value={validacionDia.descanso?.valor} disabled={isDisabled || !validacionDia.descanso?.habilitado} onChange={e => onValidationChange(dia.fecha, 'descanso', 'valor', e.target.value)} />
                </div>
            );
        }

        return (
            <>
                <div className="d-flex align-items-center mb-1">
                    <Form.Check type="checkbox" className="me-2" checked={validacionDia.antes?.habilitado} disabled={isDisabled} onChange={e => onValidationChange(dia.fecha, 'antes', 'habilitado', e.target.checked)} />
                    <Form.Label className="me-2 mb-0 fw-bold">Antes:</Form.Label>
                    <Form.Control type="time" style={{ width: '100px' }} value={validacionDia.antes?.valor} disabled={isDisabled || !validacionDia.antes?.habilitado} onChange={e => onValidationChange(dia.fecha, 'antes', 'valor', e.target.value)} />
                </div>
                <div className="d-flex align-items-center">
                    <Form.Check type="checkbox" className="me-2" checked={validacionDia.despues?.habilitado} disabled={isDisabled} onChange={e => onValidationChange(dia.fecha, 'despues', 'habilitado', e.target.checked)} />
                    <Form.Label className="me-2 mb-0 fw-bold">Después:</Form.Label>
                    <Form.Control type="time" style={{ width: '100px' }} value={validacionDia.despues?.valor} disabled={isDisabled || !validacionDia.despues?.habilitado} onChange={e => onValidationChange(dia.fecha, 'despues', 'valor', e.target.value)} />
                </div>
            </>
        );
    };

    // --- Lógica para la celda "Marcar como Pendiente" ---
    const renderCeldaPendiente = () => {
         if (dia.estado_final === 'Pendiente por Corrección') {
            return (
                <>
                    <em>{dia.notas || 'Sin nota.'}</em>
                    <button className="btn btn-link btn-sm p-0 mt-1" onClick={() => onRevalidar(dia.rut_con_formato, dia.fecha)}>
                        Re-Validar
                    </button>
                </>
            );
        }
         if (dia.estado_final === 'No Guardado' && (dia.marca_real_inicio || dia.marca_real_fin)) {
            return (
                <>
                    <Form.Check 
                        type="checkbox"
                        label="Marcar"
                        checked={validacionDia.pendiente || false}
                        onChange={(e) => onSimpleChange(dia.fecha, 'pendiente', e.target.checked)}
                    />
                    {validacionDia.pendiente && (
                        <Form.Select size="sm" className="mt-1" value={validacionDia.nota || ''} onChange={(e) => onSimpleChange(dia.fecha, 'nota', e.target.value)}>
                            <option value="">Seleccione motivo...</option>
                            <option value="Pendiente de cambio de turno">Cambio de turno</option>
                            <option value="Pendiente de corrección de marcas">Corrección de marcas</option>
                        </Form.Select>
                    )}
                </>
            );
        }
        return '---'; // Si ya está validado o no aplica
    };

    return (
        <tr style={{ backgroundColor: validacionDia.pendiente ? '#fff9e6' : dia.estado_final === 'Validado' ? '#e6ffed' : '' }}>
            <td><strong>{dia.fecha}</strong></td>
            <td>
                <div>Turno: {esDescanso ? 'Descanso' : `${dia.inicio_turno_teorico || 'N/A'} - ${dia.fin_turno_teorico || 'N/A'}`}</div>
                <div>Marcas: {`${dia.marca_real_inicio || 'N/A'} - ${dia.marca_real_fin || 'N/A'}`}</div>
            </td>
            <td>
                <div>Antes: {decimalToHHMM(dia.hhee_inicio_calculadas)}</div>
                <div>Después: {decimalToHHMM(dia.hhee_fin_calculadas)}</div>
                <div>Descanso: {decimalToHHMM(dia.cantidad_hhee_calculadas)}</div>
            </td>
            <td>{renderInputsHHEE()}</td>
            <td>
                <div>Antes: {decimalToHHMM(dia.hhee_autorizadas_antes_gv)}</div>
                <div>Después: {decimalToHHMM(dia.hhee_autorizadas_despues_gv)}</div>
            </td>
            <td>{renderCeldaPendiente()}</td>
        </tr>
    );
}

export default ResultadoFila;