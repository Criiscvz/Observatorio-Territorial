<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Mongo\Models;

use MongoDB\Laravel\Eloquent\Model;

class RegistroDatoMongoModel extends Model
{
    protected $connection = 'mongodb';

    // mongodb/laravel-mongodb v5 ignora $collection: la colección se define con $table.
    protected $table = 'registros_datos';

    /**
     * No usamos updated_at; created_at se gestiona manualmente al insertar.
     */
    public $timestamps = false;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'dataset_id',
        'data',
        'created_at',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'data' => 'array',
    ];
}
