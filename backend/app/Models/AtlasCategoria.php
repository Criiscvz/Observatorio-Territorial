<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AtlasCategoria extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'atlas_categorias';
    protected $fillable = ['nombre', 'descripcion'];
    protected $visible = ['id', 'nombre', 'descripcion'];

    public static function normalize(string $nombre): string
    {
        return trim(preg_replace('/\s+/u', ' ', $nombre));
    }

    public static function key(string $nombre): string
    {
        return mb_strtolower(self::normalize($nombre), 'UTF-8');
    }

    public function setNombreAttribute(string $nombre): void
    {
        $this->attributes['nombre'] = self::normalize($nombre);
        $this->attributes['nombre_clave'] = self::key($nombre);
    }

    public function publicaciones(): HasMany
    {
        return $this->hasMany(ObservatorioPublicacion::class, 'atlas_categoria_id');
    }
}
