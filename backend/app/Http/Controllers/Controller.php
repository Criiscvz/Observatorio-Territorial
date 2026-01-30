<?php

namespace App\Http\Controllers;

use OpenApi\Attributes as OA;

#[OA\Info(
    version: '1.0.0',
    title: 'Observatorio ULEAM API',
    description: 'API para el Sistema de Gestión y Visualización de Datos Universitarios',
    contact: new OA\Contact(
        name: 'ULEAM',
        email: 'soporte@uleam.edu.ec'
    )
)]
#[OA\Server(
    url: 'http://localhost:8000/api',
    description: 'Servidor de desarrollo'
)]
#[OA\SecurityScheme(
    securityScheme: 'sanctum',
    type: 'apiKey',
    name: 'Authorization',
    in: 'header',
    description: 'Ingresa el token en formato: Bearer <token>'
)]
abstract class Controller
{
    //
}
