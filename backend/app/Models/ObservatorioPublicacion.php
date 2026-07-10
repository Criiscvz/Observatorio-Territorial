<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ObservatorioPublicacion extends Model
{
    use HasUuids;

    protected $table = 'observatorio_publicaciones';
    protected $fillable = ['departamento_id', 'creado_por', 'tipo', 'estado', 'solo_suscriptores', 'codigo', 'titulo', 'fecha_publicacion', 'link_url', 'descripcion', 'autores', 'fuente', 'archivo_pdf', 'nombre_archivo_original', 'sharepoint_url', 'sharepoint_file_id', 'sharepoint_file_name', 'sharepoint_file_type', 'sharepoint_file_size', 'sharepoint_last_modified_at', 'sharepoint_sync_status', 'sharepoint_synced_at', 'sharepoint_error'];
    protected $casts = ['fecha_publicacion' => 'date:Y-m-d', 'solo_suscriptores' => 'boolean', 'sharepoint_last_modified_at' => 'datetime', 'sharepoint_synced_at' => 'datetime'];

    public function departamento(): BelongsTo
    {
        return $this->belongsTo(Departamento::class, 'departamento_id');
    }

    public function creadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por');
    }
}
