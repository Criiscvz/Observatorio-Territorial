<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ObservatorioPublicacion extends Model
{
    use HasUuids;

    protected $table = 'observatorio_publicaciones';
    protected $fillable = ['departamento_id', 'creado_por', 'tipo', 'codigo', 'titulo', 'fecha_publicacion', 'link_url', 'descripcion', 'autores', 'fuente', 'archivo_pdf', 'nombre_archivo_original'];
    protected $casts = ['fecha_publicacion' => 'date:Y-m-d'];

    public function departamento(): BelongsTo
    {
        return $this->belongsTo(Departamento::class, 'departamento_id');
    }

    public function creadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por');
    }
}
