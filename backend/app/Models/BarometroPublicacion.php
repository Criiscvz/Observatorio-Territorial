<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BarometroPublicacion extends Model
{
    public const SECTIONS = ['investigacion', 'vinculacion', 'barometro'];

    public const STATES = ['EN_REVISION', 'PUBLICACION', 'ARCHIVADO'];

    protected $table = 'barometro_publicaciones';

    protected $fillable = ['titulo', 'fecha_publicacion', 'fuente', 'descripcion', 'link_url', 'estado'];

    protected $hidden = ['created_at', 'updated_at'];
}
