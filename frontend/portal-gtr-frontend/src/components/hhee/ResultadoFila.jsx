// src/components/hhee/ResultadoFila.jsx

import React from 'react';
import { Form } from 'react-bootstrap';
import { decimalToHHMM } from '../../utils/timeUtils'; // Importamos desde el archivo de utilidades

function ResultadoFila({ dia, validacionDia, onValidationChange, onSimpleChange, onRevalidar }) {

    // Si no hay datos de validación para este día, no renderizamos nada para evitar errores
    if (!validacionDia) return null;

    const esDescanso = (dia.inicio_turno_teorico === '00:00' && dia.fin_turno_teorico === '00:00');
    const isDisabledGeneral = validacionDia.pendiente || dia.estado_final === 'Validado' || dia.estado_final === 'Pendiente por Corrección';

    const renderInputsHHEE = () => {
        if (dia.estado_final !== 'No Guardado') {
             return <span className="text-muted fst-italic">No editable</span>;
        }

        if (esDescanso) {
            if (!dia.cantidad_hhee_calculadas || dia.cantidad_hhee_calculadas <= 0) return '---';
            return (
                <div className="d-flex align-items-center">
                    <Form.Check type="checkbox" className="me-2" checked={validacionDia.descanso.habilitado} disabled={isDisabledGeneral} onChange={e => onValidationChange(dia.fecha, 'descanso', 'habilitado', e.target.checked)} />
                    <Form.Label className="me-2 mb-0 fw-bold" style={{whiteSpace: 'nowrap'}}>Descanso:</Form.Label>
                    <Form.Control type="time" style={{ width: '100px' }} value={validacionDia.descanso.valor} disabled={isDisabledGeneral || !validacionDia.descanso.habilitado} onChange={e => onValidationChange(dia.fecha, 'descanso', 'valor', e.target.value)} />
                </div>
            );
        }

        if (dia.hhee_inicio_calculadas <= 0 && dia.hhee_fin_calculadas <= 0) {
            return '---';
        }

        return (
            <>
                {dia.hhee_inicio_calculadas > 0 && (
                    <div className="d-flex align-items-center mb-1">
                        <Form.Check type="checkbox" className="me-2" checked={validacionDia.antes.habilitado} disabled={isDisabledGeneral} onChange={e => onValidationChange(dia.fecha, 'antes', 'habilitado', e.target.checked)} />
                        <Form.Label className="me-2 mb-0 fw-bold" style={{whiteSpace: 'nowrap'}}>Antes:</Form.Label>
                        <Form.Control type="time" style={{ width: '100px' }} value={validacionDia.antes.valor} disabled={isDisabledGeneral || !validacionDia.antes.habilitado} onChange={e => onValidationChange(dia.fecha, 'antes', 'valor', e.target.value)} />
                    </div>
                )}
                {dia.hhee_fin_calculadas > 0 && (
                    <div className="d-flex align-items-center">
                        <Form.Check type="checkbox" className="me-2" checked={validacionDia.despues.habilitado} disabled={isDisabledGeneral} onChange={e => onValidationChange(dia.fecha, 'despues', 'habilitado', e.target.checked)} />
                        <Form.Label className="me-2 mb-0 fw-bold" style={{whiteSpace: 'nowrap'}}>Después:</Form.Label>
                        <Form.Control type="time" style={{ width: '100px' }} value={validacionDia.despues.valor} disabled={isDisabledGeneral || !validacionDia.despues.habilitado} onChange={e => onValidationChange(dia.fecha, 'despues', 'valor', e.target.value)} />
                    </div>
                )}
            </>
        );
    };

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
        return '---';
    };

    const renderHHEERRHH = () => {
        if (esDescanso) {
            const totalDescansoRRHH = (dia.hhee_autorizadas_antes_gv || 0) + (dia.hhee_autorizadas_despues_gv || 0);
            return totalDescansoRRHH > 0 ? `Descanso: ${decimalToHHMM(totalDescansoRRHH)}` : "";
        }

        const antes = dia.hhee_autorizadas_antes_gv > 0 ? `Antes: ${decimalToHHMM(dia.hhee_autorizadas_antes_gv)}` : null;
        const despues = dia.hhee_autorizadas_despues_gv > 0 ? `Después: ${decimalToHHMM(dia.hhee_autorizadas_despues_gv)}` : null;

        if (!antes && !despues) return "";

        return (<>{antes && <div>{antes}</div>}{despues && <div>{despues}</div>}</>);
    };

    return (
        <tr style={{ backgroundColor: validacionDia.pendiente ? '#fff9e6' : dia.estado_final === 'Validado' ? '#e6ffed' : '' }}>
            <td><strong>{dia.fecha}</strong></td>
            <td>
                <div>Turno: {esDescanso ? 'Descanso' : `${dia.inicio_turno_teorico || 'N/A'} - ${dia.fin_turno_teorico || 'N/A'}`}</div>
                <div>Marcas: {`${dia.marca_real_inicio || 'N/A'} - ${dia.marca_real_fin || 'N/A'}`}</div>
            </td>
            <td>{renderInputsHHEE()}</td>
            <td>{renderHHEERRHH()}</td>
            <td>{renderCeldaPendiente()}</td>
            <td><span className={`badge bg-${dia.estado_final === 'Validado' ? 'success' : dia.estado_final === 'Pendiente por Corrección' ? 'warning' : 'secondary'}`}>{dia.estado_final}</span></td>
        </tr>
    );
}

export default ResultadoFila;