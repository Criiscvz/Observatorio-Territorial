<?php

namespace Database\Seeders;

use App\Infrastructure\Persistence\Eloquent\Models\CategoriaDatasetModel;
use App\Infrastructure\Persistence\Eloquent\Models\DatasetFuenteModel;
use App\Infrastructure\Persistence\Eloquent\Models\DatasetModel;
use App\Infrastructure\Persistence\Eloquent\Models\DepartamentoModel;
use App\Infrastructure\Persistence\Eloquent\Models\GraficoPredeterminadoModel;
use App\Infrastructure\Persistence\Eloquent\Models\RegistroDatoModel;
use App\Infrastructure\Persistence\Eloquent\Models\VariableMetadatoModel;
use App\Models\Perfil;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DemoDataSeeder extends Seeder
{
    /**
     * Seed demo data for ALL entities.
     */
    public function run(): void
    {
        $this->command->info('🌱 Generando datos de demostración...');

        // 1. Usuarios
        $users = $this->createUsers();
        $admin = User::where('rol', 'ADMIN')->first();

        // 2. Perfiles
        $this->createPerfiles($users);

        // 3. Departamentos y asignaciones
        $departamentos = DepartamentoModel::all();
        $this->assignUsersToDepartamentos($users, $departamentos);

        // 4. Categorías
        $categorias = CategoriaDatasetModel::all();

        // 5. Datasets con variables, registros, fuentes y gráficos predeterminados
        $this->createDatasetsCompletos($departamentos, $categorias, $admin, $users);

        $this->command->info('✅ Datos de demostración generados exitosamente.');
    }

    // ─────────────────────────────────────────────
    //  USUARIOS
    // ─────────────────────────────────────────────

    private function createUsers(): array
    {
        $usersData = [
            [
                'name' => 'María García López',
                'email' => 'maria.garcia@uleam.edu.ec',
                'password' => Hash::make('password123'),
                'rol' => 'USER',
                'email_verified_at' => now(),
            ],
            [
                'name' => 'Carlos Mendoza Reyes',
                'email' => 'carlos.mendoza@uleam.edu.ec',
                'password' => Hash::make('password123'),
                'rol' => 'EDITOR',
                'email_verified_at' => now(),
            ],
            [
                'name' => 'Ana Lucía Cevallos',
                'email' => 'ana.cevallos@uleam.edu.ec',
                'password' => Hash::make('password123'),
                'rol' => 'USER',
                'email_verified_at' => now(),
            ],
            [
                'name' => 'Roberto Zambrano Mera',
                'email' => 'roberto.zambrano@uleam.edu.ec',
                'password' => Hash::make('password123'),
                'rol' => 'USER',
                'email_verified_at' => now(),
            ],
            [
                'name' => 'Patricia Moreira Alcívar',
                'email' => 'patricia.moreira@uleam.edu.ec',
                'password' => Hash::make('password123'),
                'rol' => 'USER',
                'email_verified_at' => now(),
            ],
        ];

        $users = [];
        foreach ($usersData as $userData) {
            $users[] = User::firstOrCreate(
                ['email' => $userData['email']],
                $userData
            );
        }

        $this->command->info("  👤 Usuarios creados: " . count($users));
        return $users;
    }

    // ─────────────────────────────────────────────
    //  PERFILES
    // ─────────────────────────────────────────────

    private function createPerfiles(array $users): void
    {
        $perfilesData = [
            ['cargo' => 'Docente Investigadora', 'telefono' => '+593 99 123 4567', 'bio' => 'Especialista en ecología y biodiversidad con 10 años de experiencia en investigación de campo.'],
            ['cargo' => 'Coordinador de Vinculación', 'telefono' => '+593 98 234 5678', 'bio' => 'Líder de proyectos de vinculación comunitaria y desarrollo territorial.'],
            ['cargo' => 'Investigadora Social', 'telefono' => '+593 97 345 6789', 'bio' => 'Socióloga con enfoque en economía del cuidado y género.'],
            ['cargo' => 'Analista de Datos', 'telefono' => '+593 96 456 7890', 'bio' => 'Ingeniero de datos con experiencia en análisis estadístico territorial.'],
            ['cargo' => 'Directora de Cultura', 'telefono' => '+593 95 567 8901', 'bio' => 'Antropóloga dedicada al estudio de saberes ancestrales y patrimonio cultural.'],
        ];

        foreach ($users as $i => $user) {
            if (isset($perfilesData[$i])) {
                Perfil::firstOrCreate(
                    ['user_id' => $user->id],
                    array_merge($perfilesData[$i], ['user_id' => $user->id])
                );
            }
        }

        $this->command->info("  📋 Perfiles creados");
    }

    // ─────────────────────────────────────────────
    //  ASIGNACIONES USUARIO-DEPARTAMENTO
    // ─────────────────────────────────────────────

    private function assignUsersToDepartamentos(array $users, $departamentos): void
    {
        $assignments = [
            // María → Vitalidad Ecológica (ADMIN), Resiliencia (EDITOR)
            0 => [['depto' => 'VITALIDAD_ECOLOGICA', 'rol' => 'ADMIN'], ['depto' => 'RESILIENCIA', 'rol' => 'EDITOR']],
            // Carlos → Gobernanza (ADMIN), Vinculación datasets
            1 => [['depto' => 'GOBERNANZA', 'rol' => 'ADMIN'], ['depto' => 'ECONOMIA_CUIDADO', 'rol' => 'EDITOR']],
            // Ana → Economía del Cuidado (ADMIN)
            2 => [['depto' => 'ECONOMIA_CUIDADO', 'rol' => 'ADMIN']],
            // Roberto → Resiliencia (ADMIN), Vitalidad Ecológica (LECTOR)
            3 => [['depto' => 'RESILIENCIA', 'rol' => 'ADMIN'], ['depto' => 'VITALIDAD_ECOLOGICA', 'rol' => 'LECTOR']],
            // Patricia → Saberes y Cultura (ADMIN)
            4 => [['depto' => 'SABERES_CULTURA', 'rol' => 'ADMIN']],
        ];

        $count = 0;
        foreach ($assignments as $userIndex => $deptoAssignments) {
            if (!isset($users[$userIndex])) continue;
            $user = $users[$userIndex];

            foreach ($deptoAssignments as $assignment) {
                $depto = $departamentos->firstWhere('codigo_interno', $assignment['depto']);
                if (!$depto) continue;

                DB::table('usuario_departamento')->updateOrInsert(
                    ['user_id' => $user->id, 'departamento_id' => $depto->id],
                    [
                        'id' => Str::uuid()->toString(),
                        'rol' => $assignment['rol'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
                $count++;
            }
        }

        $this->command->info("  🔗 Asignaciones usuario-departamento: {$count}");
    }

    // ─────────────────────────────────────────────
    //  DATASETS COMPLETOS
    // ─────────────────────────────────────────────

    private function createDatasetsCompletos($departamentos, $categorias, $admin, $users): void
    {
        $datasetsConfig = $this->getDatasetsConfig();

        foreach ($datasetsConfig as $config) {
            $depto = $departamentos->firstWhere('codigo_interno', $config['departamento']);
            $categoria = $categorias->firstWhere('codigo', $config['categoria']);
            $uploader = $users[$config['user_index']] ?? $admin;

            if (!$depto) {
                $this->command->warn("  ⚠️ Departamento no encontrado: {$config['departamento']}");
                continue;
            }

            // Verificar si ya existe
            $existingDataset = DatasetModel::where('nombre', $config['nombre'])
                ->where('departamento_id', $depto->id)
                ->first();

            if ($existingDataset) {
                $this->command->info("  📊 Dataset ya existe: {$config['nombre']}");
                continue;
            }

            // Crear dataset
            $dataset = DatasetModel::create([
                'departamento_id' => $depto->id,
                'categoria_id' => $categoria?->id,
                'subido_por' => $uploader->id,
                'nombre' => $config['nombre'],
                'nombre_archivo' => $config['archivo'],
                'descripcion' => $config['descripcion'],
                'enlace_fuente' => $config['enlace_fuente'] ?? null,
                'estado' => 'COMPLETADO',
                'total_registros' => $config['total_registros'],
                'fecha_carga' => now()->subDays(rand(1, 90)),
            ]);

            // Crear variables
            $variables = $this->createVariables($dataset, $config['variables']);

            // Crear registros
            $this->createRegistros($dataset, $config['variables'], $config['total_registros']);

            // Crear fuentes
            $this->createFuentes($dataset, $config['fuentes'] ?? []);

            // Crear gráficos predeterminados
            $this->createGraficosPredeterminados($dataset, $variables, $uploader, $config['graficos'] ?? []);

            $this->command->info("  📊 Dataset creado: {$config['nombre']} ({$config['total_registros']} registros)");
        }
    }

    // ─────────────────────────────────────────────
    //  CONFIGURACIÓN DE DATASETS
    // ─────────────────────────────────────────────

    private function getDatasetsConfig(): array
    {
        return [
            // ── VITALIDAD ECOLÓGICA ──
            [
                'nombre' => 'Censo de Biodiversidad Costera 2025',
                'archivo' => 'censo_biodiversidad_2025.csv',
                'descripcion' => 'Registro de especies de fauna y flora identificadas en la franja costera de Manabí durante el censo 2025.',
                'departamento' => 'VITALIDAD_ECOLOGICA',
                'categoria' => 'INVESTIGACION',
                'user_index' => 0,
                'total_registros' => 150,
                'enlace_fuente' => 'https://investigacion.uleam.edu.ec/biodiversidad',
                'variables' => [
                    ['nombre_columna' => 'especie', 'nombre_original' => 'Especie', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Cangrejo rojo', 'Fragata', 'Pelícano', 'Iguana marina', 'Tortuga verde', 'Garza real', 'Camarón', 'Corvina', 'Manglar rojo', 'Manglar negro']],
                    ['nombre_columna' => 'zona', 'nombre_original' => 'Zona de muestreo', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Playa Norte', 'Estuario Sur', 'Manglar Central', 'Arrecife Oeste', 'Bahía Este']],
                    ['nombre_columna' => 'cantidad', 'nombre_original' => 'Cantidad observada', 'tipo_dato' => 'NUMERICO', 'opciones' => null],
                    ['nombre_columna' => 'fecha_observacion', 'nombre_original' => 'Fecha de observación', 'tipo_dato' => 'FECHA', 'opciones' => null],
                    ['nombre_columna' => 'estado_conservacion', 'nombre_original' => 'Estado de conservación', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Estable', 'En peligro', 'Vulnerable', 'Crítico', 'Recuperación']],
                    ['nombre_columna' => 'observaciones', 'nombre_original' => 'Observaciones', 'tipo_dato' => 'TEXTO', 'opciones' => null],
                ],
                'fuentes' => [
                    ['titulo' => 'Ministerio del Ambiente Ecuador', 'url' => 'https://www.ambiente.gob.ec/', 'descripcion' => 'Datos oficiales de biodiversidad nacional.'],
                    ['titulo' => 'IUCN Red List', 'url' => 'https://www.iucnredlist.org/', 'descripcion' => 'Lista roja de especies amenazadas.'],
                ],
                'graficos' => [
                    ['titulo' => 'Especies por zona', 'tipo_grafico' => 'bar', 'var_x' => 'especie', 'descripcion' => 'Distribución de especies por zona de muestreo'],
                    ['titulo' => 'Estado de conservación', 'tipo_grafico' => 'pie', 'var_x' => 'estado_conservacion', 'descripcion' => 'Proporción de estados de conservación'],
                ],
            ],
            [
                'nombre' => 'Calidad del Agua Río Chone 2025',
                'archivo' => 'calidad_agua_chone_2025.csv',
                'descripcion' => 'Mediciones de parámetros fisicoquímicos del agua en puntos clave del río Chone.',
                'departamento' => 'VITALIDAD_ECOLOGICA',
                'categoria' => 'INVESTIGACION',
                'user_index' => 0,
                'total_registros' => 120,
                'enlace_fuente' => null,
                'variables' => [
                    ['nombre_columna' => 'punto_muestreo', 'nombre_original' => 'Punto de muestreo', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Naciente', 'Tramo urbano', 'Puente San Andrés', 'Desembocadura', 'Embalse La Esperanza']],
                    ['nombre_columna' => 'ph', 'nombre_original' => 'pH', 'tipo_dato' => 'NUMERICO', 'opciones' => null],
                    ['nombre_columna' => 'oxigeno_disuelto', 'nombre_original' => 'Oxígeno disuelto (mg/L)', 'tipo_dato' => 'NUMERICO', 'opciones' => null],
                    ['nombre_columna' => 'temperatura', 'nombre_original' => 'Temperatura (°C)', 'tipo_dato' => 'NUMERICO', 'opciones' => null],
                    ['nombre_columna' => 'fecha_medicion', 'nombre_original' => 'Fecha de medición', 'tipo_dato' => 'FECHA', 'opciones' => null],
                    ['nombre_columna' => 'calificacion', 'nombre_original' => 'Calificación', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Excelente', 'Buena', 'Aceptable', 'Deficiente', 'Crítica']],
                ],
                'fuentes' => [
                    ['titulo' => 'SENAGUA', 'url' => 'https://www.agua.gob.ec/', 'descripcion' => 'Secretaría Nacional del Agua.'],
                ],
                'graficos' => [
                    ['titulo' => 'pH por punto de muestreo', 'tipo_grafico' => 'bar', 'var_x' => 'calificacion', 'descripcion' => 'Valores de pH en cada punto'],
                ],
            ],

            // ── ECONOMÍA DEL CUIDADO ──
            [
                'nombre' => 'Encuesta de Uso del Tiempo 2025',
                'archivo' => 'encuesta_uso_tiempo_2025.csv',
                'descripcion' => 'Encuesta sobre distribución del tiempo en actividades de cuidado no remunerado en hogares de Manabí.',
                'departamento' => 'ECONOMIA_CUIDADO',
                'categoria' => 'INVESTIGACION',
                'user_index' => 2,
                'total_registros' => 200,
                'enlace_fuente' => 'https://investigacion.uleam.edu.ec/cuidado',
                'variables' => [
                    ['nombre_columna' => 'genero', 'nombre_original' => 'Género', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Femenino', 'Masculino', 'No binario']],
                    ['nombre_columna' => 'edad', 'nombre_original' => 'Edad', 'tipo_dato' => 'NUMERICO', 'opciones' => null],
                    ['nombre_columna' => 'horas_cuidado', 'nombre_original' => 'Horas de cuidado diarias', 'tipo_dato' => 'NUMERICO', 'opciones' => null],
                    ['nombre_columna' => 'tipo_cuidado', 'nombre_original' => 'Tipo de cuidado', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Niños/as', 'Adultos mayores', 'Personas con discapacidad', 'Tareas domésticas', 'Alimentación']],
                    ['nombre_columna' => 'canton', 'nombre_original' => 'Cantón', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Portoviejo', 'Manta', 'Chone', 'Jipijapa', 'El Carmen', 'Pedernales']],
                    ['nombre_columna' => 'ingreso_hogar', 'nombre_original' => 'Ingreso mensual del hogar (USD)', 'tipo_dato' => 'NUMERICO', 'opciones' => null],
                    ['nombre_columna' => 'nivel_educativo', 'nombre_original' => 'Nivel educativo', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Primaria', 'Secundaria', 'Superior', 'Posgrado', 'Sin educación formal']],
                    ['nombre_columna' => 'comentario', 'nombre_original' => 'Comentario', 'tipo_dato' => 'TEXTO', 'opciones' => null],
                ],
                'fuentes' => [
                    ['titulo' => 'INEC Ecuador - Uso del Tiempo', 'url' => 'https://www.ecuadorencifras.gob.ec/', 'descripcion' => 'Encuesta nacional de uso del tiempo.'],
                    ['titulo' => 'ONU Mujeres', 'url' => 'https://www.unwomen.org/', 'descripcion' => 'Datos globales sobre trabajo no remunerado.'],
                ],
                'graficos' => [
                    ['titulo' => 'Horas de cuidado por género', 'tipo_grafico' => 'bar', 'var_x' => 'genero', 'descripcion' => 'Comparación de horas de cuidado entre géneros'],
                    ['titulo' => 'Distribución por tipo de cuidado', 'tipo_grafico' => 'pie', 'var_x' => 'tipo_cuidado', 'descripcion' => 'Tipos de cuidado más frecuentes'],
                    ['titulo' => 'Distribución por cantón', 'tipo_grafico' => 'bar', 'var_x' => 'canton', 'descripcion' => 'Encuestados por cantón'],
                ],
            ],

            // ── SABERES Y CULTURA VIVA ──
            [
                'nombre' => 'Inventario de Expresiones Culturales',
                'archivo' => 'inventario_cultural_2025.csv',
                'descripcion' => 'Catálogo de expresiones culturales inmateriales identificadas en comunidades rurales de Manabí.',
                'departamento' => 'SABERES_CULTURA',
                'categoria' => 'VINCULACION',
                'user_index' => 4,
                'total_registros' => 80,
                'enlace_fuente' => null,
                'variables' => [
                    ['nombre_columna' => 'expresion', 'nombre_original' => 'Expresión cultural', 'tipo_dato' => 'TEXTO', 'opciones' => null],
                    ['nombre_columna' => 'tipo', 'nombre_original' => 'Tipo', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Música', 'Danza', 'Gastronomía', 'Artesanía', 'Tradición oral', 'Ritual', 'Medicina ancestral']],
                    ['nombre_columna' => 'comunidad', 'nombre_original' => 'Comunidad', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['San Isidro', 'Agua Blanca', 'Pile', 'Jama', 'San Plácido', 'Calceta']],
                    ['nombre_columna' => 'portadores', 'nombre_original' => 'Número de portadores', 'tipo_dato' => 'NUMERICO', 'opciones' => null],
                    ['nombre_columna' => 'estado_vitalidad', 'nombre_original' => 'Estado de vitalidad', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Vigente', 'En riesgo', 'En decadencia', 'Revitalizada']],
                    ['nombre_columna' => 'descripcion_practica', 'nombre_original' => 'Descripción de la práctica', 'tipo_dato' => 'TEXTO', 'opciones' => null],
                ],
                'fuentes' => [
                    ['titulo' => 'INPC Ecuador', 'url' => 'https://www.patrimoniocultural.gob.ec/', 'descripcion' => 'Instituto Nacional de Patrimonio Cultural.'],
                ],
                'graficos' => [
                    ['titulo' => 'Expresiones por tipo', 'tipo_grafico' => 'pie', 'var_x' => 'tipo', 'descripcion' => 'Distribución por tipo de expresión cultural'],
                    ['titulo' => 'Vitalidad cultural', 'tipo_grafico' => 'donut', 'var_x' => 'estado_vitalidad', 'descripcion' => 'Estado de vitalidad de las expresiones'],
                ],
            ],

            // ── GOBERNANZA COMUNITARIA ──
            [
                'nombre' => 'Presupuestos Participativos 2024-2025',
                'archivo' => 'presupuestos_participativos_2025.csv',
                'descripcion' => 'Registro de asignaciones y ejecución de presupuestos participativos en parroquias rurales de Manabí.',
                'departamento' => 'GOBERNANZA',
                'categoria' => 'BAROMETRO',
                'user_index' => 1,
                'total_registros' => 100,
                'enlace_fuente' => 'https://gobernanza.uleam.edu.ec/presupuestos',
                'variables' => [
                    ['nombre_columna' => 'parroquia', 'nombre_original' => 'Parroquia', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Abdón Calderón', 'Alhajuela', 'Crucita', 'Riochico', 'San Plácido', 'Chirijos', 'Colón', 'América']],
                    ['nombre_columna' => 'sector', 'nombre_original' => 'Sector de inversión', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Salud', 'Educación', 'Infraestructura vial', 'Agua potable', 'Saneamiento', 'Cultura', 'Deporte']],
                    ['nombre_columna' => 'monto_asignado', 'nombre_original' => 'Monto asignado (USD)', 'tipo_dato' => 'NUMERICO', 'opciones' => null],
                    ['nombre_columna' => 'monto_ejecutado', 'nombre_original' => 'Monto ejecutado (USD)', 'tipo_dato' => 'NUMERICO', 'opciones' => null],
                    ['nombre_columna' => 'participantes', 'nombre_original' => 'Número de participantes', 'tipo_dato' => 'NUMERICO', 'opciones' => null],
                    ['nombre_columna' => 'fecha_asamblea', 'nombre_original' => 'Fecha de asamblea', 'tipo_dato' => 'FECHA', 'opciones' => null],
                    ['nombre_columna' => 'estado_proyecto', 'nombre_original' => 'Estado del proyecto', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Planificado', 'En ejecución', 'Ejecutado', 'Suspendido']],
                ],
                'fuentes' => [
                    ['titulo' => 'GAD Provincial de Manabí', 'url' => 'https://www.manabi.gob.ec/', 'descripcion' => 'Gobierno Autónomo Descentralizado de Manabí.'],
                    ['titulo' => 'CPCCS', 'url' => 'https://www.cpccs.gob.ec/', 'descripcion' => 'Consejo de Participación Ciudadana.'],
                ],
                'graficos' => [
                    ['titulo' => 'Inversión por sector', 'tipo_grafico' => 'bar', 'var_x' => 'sector', 'descripcion' => 'Distribución del presupuesto por sector'],
                    ['titulo' => 'Estado de proyectos', 'tipo_grafico' => 'pie', 'var_x' => 'estado_proyecto', 'descripcion' => 'Estado actual de los proyectos participativos'],
                ],
            ],
            [
                'nombre' => 'Encuesta de Participación Ciudadana',
                'archivo' => 'participacion_ciudadana_2025.csv',
                'descripcion' => 'Percepción ciudadana sobre mecanismos de participación y gobernanza local en cantones de Manabí.',
                'departamento' => 'GOBERNANZA',
                'categoria' => 'VINCULACION',
                'user_index' => 1,
                'total_registros' => 180,
                'enlace_fuente' => null,
                'variables' => [
                    ['nombre_columna' => 'canton', 'nombre_original' => 'Cantón', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Portoviejo', 'Manta', 'Chone', 'Jipijapa', 'El Carmen', 'Pedernales', 'Bolívar', 'Junín']],
                    ['nombre_columna' => 'nivel_confianza', 'nombre_original' => 'Nivel de confianza institucional (1-10)', 'tipo_dato' => 'NUMERICO', 'opciones' => null],
                    ['nombre_columna' => 'participa_asambleas', 'nombre_original' => 'Participa en asambleas', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Sí, regularmente', 'A veces', 'Nunca']],
                    ['nombre_columna' => 'rango_edad', 'nombre_original' => 'Rango de edad', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['18-25', '26-35', '36-45', '46-55', '56-65', '65+']],
                    ['nombre_columna' => 'genero', 'nombre_original' => 'Género', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Femenino', 'Masculino', 'No binario']],
                    ['nombre_columna' => 'sugerencia', 'nombre_original' => 'Sugerencia para mejorar', 'tipo_dato' => 'TEXTO', 'opciones' => null],
                ],
                'fuentes' => [],
                'graficos' => [
                    ['titulo' => 'Participación por cantón', 'tipo_grafico' => 'bar', 'var_x' => 'canton', 'descripcion' => 'Distribución de encuestados'],
                    ['titulo' => 'Participación en asambleas', 'tipo_grafico' => 'donut', 'var_x' => 'participa_asambleas', 'descripcion' => 'Frecuencia de participación en asambleas'],
                ],
            ],

            // ── RESILIENCIA ──
            [
                'nombre' => 'Evaluación de Riesgos Naturales 2025',
                'archivo' => 'riesgos_naturales_2025.csv',
                'descripcion' => 'Evaluación del nivel de vulnerabilidad y preparación ante riesgos naturales en comunidades costeras.',
                'departamento' => 'RESILIENCIA',
                'categoria' => 'BAROMETRO',
                'user_index' => 3,
                'total_registros' => 130,
                'enlace_fuente' => 'https://resiliencia.uleam.edu.ec/riesgos',
                'variables' => [
                    ['nombre_columna' => 'comunidad', 'nombre_original' => 'Comunidad', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['San José', 'Las Gilces', 'San Jacinto', 'Canoa', 'Pedernales', 'Cojimíes', 'Bahía de Caráquez', 'Jama']],
                    ['nombre_columna' => 'tipo_riesgo', 'nombre_original' => 'Tipo de riesgo', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Sismo', 'Inundación', 'Deslizamiento', 'Tsunami', 'Sequía', 'Incendio forestal']],
                    ['nombre_columna' => 'nivel_vulnerabilidad', 'nombre_original' => 'Nivel de vulnerabilidad (1-10)', 'tipo_dato' => 'NUMERICO', 'opciones' => null],
                    ['nombre_columna' => 'tiene_plan_emergencia', 'nombre_original' => 'Tiene plan de emergencia', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Sí', 'No', 'En elaboración']],
                    ['nombre_columna' => 'fecha_ultima_evaluacion', 'nombre_original' => 'Fecha última evaluación', 'tipo_dato' => 'FECHA', 'opciones' => null],
                    ['nombre_columna' => 'acciones_recomendadas', 'nombre_original' => 'Acciones recomendadas', 'tipo_dato' => 'TEXTO', 'opciones' => null],
                ],
                'fuentes' => [
                    ['titulo' => 'SGR Ecuador', 'url' => 'https://www.gestionderiesgos.gob.ec/', 'descripcion' => 'Servicio Nacional de Gestión de Riesgos.'],
                    ['titulo' => 'IG-EPN', 'url' => 'https://www.igepn.edu.ec/', 'descripcion' => 'Instituto Geofísico de la Escuela Politécnica Nacional.'],
                ],
                'graficos' => [
                    ['titulo' => 'Vulnerabilidad por comunidad', 'tipo_grafico' => 'bar', 'var_x' => 'comunidad', 'descripcion' => 'Nivel de vuln. promedio por comunidad'],
                    ['titulo' => 'Tipos de riesgo', 'tipo_grafico' => 'pie', 'var_x' => 'tipo_riesgo', 'descripcion' => 'Distribución de tipos de riesgo evaluados'],
                    ['titulo' => 'Planes de emergencia', 'tipo_grafico' => 'donut', 'var_x' => 'tiene_plan_emergencia', 'descripcion' => 'Proporción de comunidades con plan'],
                ],
            ],
            [
                'nombre' => 'Seguridad Alimentaria Familiar',
                'archivo' => 'seguridad_alimentaria_2025.csv',
                'descripcion' => 'Indicadores de seguridad alimentaria e inseguridad en hogares rurales de Manabí.',
                'departamento' => 'RESILIENCIA',
                'categoria' => 'INVESTIGACION',
                'user_index' => 3,
                'total_registros' => 160,
                'enlace_fuente' => null,
                'variables' => [
                    ['nombre_columna' => 'canton', 'nombre_original' => 'Cantón', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Portoviejo', 'Chone', 'El Carmen', 'Flavio Alfaro', 'Bolívar', 'Junín']],
                    ['nombre_columna' => 'nivel_inseguridad', 'nombre_original' => 'Nivel de inseguridad alimentaria', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Seguro', 'Inseguridad leve', 'Inseguridad moderada', 'Inseguridad grave']],
                    ['nombre_columna' => 'miembros_hogar', 'nombre_original' => 'Miembros del hogar', 'tipo_dato' => 'NUMERICO', 'opciones' => null],
                    ['nombre_columna' => 'ingreso_mensual', 'nombre_original' => 'Ingreso mensual (USD)', 'tipo_dato' => 'NUMERICO', 'opciones' => null],
                    ['nombre_columna' => 'tiene_huerto', 'nombre_original' => '¿Tiene huerto familiar?', 'tipo_dato' => 'CATEGORICO', 'opciones' => ['Sí', 'No']],
                    ['nombre_columna' => 'comidas_diarias', 'nombre_original' => 'Comidas diarias', 'tipo_dato' => 'NUMERICO', 'opciones' => null],
                    ['nombre_columna' => 'observacion', 'nombre_original' => 'Observación', 'tipo_dato' => 'TEXTO', 'opciones' => null],
                ],
                'fuentes' => [
                    ['titulo' => 'FAO Ecuador', 'url' => 'https://www.fao.org/ecuador/', 'descripcion' => 'Organización de las Naciones Unidas para la Alimentación.'],
                ],
                'graficos' => [
                    ['titulo' => 'Inseguridad alimentaria', 'tipo_grafico' => 'pie', 'var_x' => 'nivel_inseguridad', 'descripcion' => 'Distribución de niveles de inseguridad'],
                ],
            ],
        ];
    }

    // ─────────────────────────────────────────────
    //  VARIABLES
    // ─────────────────────────────────────────────

    private function createVariables(DatasetModel $dataset, array $variablesConfig): array
    {
        $createdVars = [];
        foreach ($variablesConfig as $i => $varConfig) {
            $var = VariableMetadatoModel::create([
                'dataset_id' => $dataset->id,
                'nombre_columna' => $varConfig['nombre_columna'],
                'nombre_original' => $varConfig['nombre_original'],
                'tipo_dato' => $varConfig['tipo_dato'],
                'tipo_detectado' => $varConfig['tipo_dato'],
                'es_visible' => true,
                'orden' => $i,
                'opciones' => $varConfig['opciones'],
            ]);
            $createdVars[$varConfig['nombre_columna']] = $var;
        }
        return $createdVars;
    }

    // ─────────────────────────────────────────────
    //  REGISTROS (DATOS)
    // ─────────────────────────────────────────────

    private function createRegistros(DatasetModel $dataset, array $variablesConfig, int $count): void
    {
        $records = [];
        $now = now();

        for ($i = 0; $i < $count; $i++) {
            $data = [];
            foreach ($variablesConfig as $varConfig) {
                $data[$varConfig['nombre_columna']] = $this->generateValue($varConfig);
            }

            $records[] = [
                'dataset_id' => $dataset->id,
                'data' => json_encode($data),
                'created_at' => $now,
                'updated_at' => $now,
            ];

            // Insertar en lotes de 50
            if (count($records) >= 50) {
                DB::table('registros_datos')->insert($records);
                $records = [];
            }
        }

        // Insertar restantes
        if (!empty($records)) {
            DB::table('registros_datos')->insert($records);
        }
    }

    private function generateValue(array $varConfig): mixed
    {
        return match ($varConfig['tipo_dato']) {
            'CATEGORICO' => $this->randomOption($varConfig['opciones'] ?? []),
            'NUMERICO' => $this->generateNumeric($varConfig['nombre_columna']),
            'FECHA' => $this->generateDate(),
            'TEXTO' => $this->generateText($varConfig['nombre_columna']),
        };
    }

    private function randomOption(array $opciones): ?string
    {
        return !empty($opciones) ? $opciones[array_rand($opciones)] : null;
    }

    private function generateNumeric(string $column): float|int
    {
        return match (true) {
            str_contains($column, 'edad') => rand(18, 85),
            str_contains($column, 'horas') => round(rand(0, 140) / 10, 1),
            str_contains($column, 'ph') => round(rand(55, 85) / 10, 1),
            str_contains($column, 'oxigeno') => round(rand(30, 120) / 10, 1),
            str_contains($column, 'temperatura') => round(rand(200, 340) / 10, 1),
            str_contains($column, 'monto') => rand(500, 50000),
            str_contains($column, 'participantes') => rand(15, 300),
            str_contains($column, 'vulnerabilidad') || str_contains($column, 'confianza') => rand(1, 10),
            str_contains($column, 'miembros') => rand(1, 10),
            str_contains($column, 'ingreso') => rand(200, 2500),
            str_contains($column, 'comidas') => rand(1, 4),
            str_contains($column, 'cantidad') => rand(1, 200),
            str_contains($column, 'portadores') => rand(2, 50),
            default => rand(1, 100),
        };
    }

    private function generateDate(): string
    {
        $start = strtotime('2024-01-01');
        $end = strtotime('2025-12-31');
        return date('Y-m-d', rand($start, $end));
    }

    private function generateText(string $column): string
    {
        $texts = match (true) {
            str_contains($column, 'observacion') || str_contains($column, 'observaciones') => [
                'Se observó buena salud en los especímenes analizados durante la jornada de muestreo.',
                'Presencia de contaminación por desechos plásticos en la zona de evaluación.',
                'La comunidad reporta disminución de especies en los últimos años de monitoreo ambiental.',
                'Condiciones climáticas favorables durante el período de observación registrado.',
                'Se requiere seguimiento continuo para evaluar tendencias a largo plazo.',
                'Nivel de agua por debajo del promedio estacional en el punto de medición.',
                'Familias manifiestan dificultades para acceder a alimentos frescos nutritivos.',
                'El huerto comunitario ha mejorado el acceso a vegetales de la zona.',
                'Se identificaron factores de riesgo asociados al cambio climático global.',
                'La producción agrícola local ha disminuido respecto al año anterior reportado.',
            ],
            str_contains($column, 'expresion') => [
                'Amorfino manabita tradicional cantado en festividades patronales',
                'Elaboración de sombreros de paja toquilla con técnicas ancestrales',
                'Preparación del viche con recetas transmitidas por generaciones',
                'Danza del chigualo en celebraciones navideñas comunitarias',
                'Tejido de hamacas de algodón con telares artesanales manuales',
                'Preparación del greñoso con receta familiar ancestral',
                'Tallado en tagua para artesanías decorativas y utilitarias',
                'Curación con plantas medicinales por curanderos de la zona',
                'Relatos orales sobre la historia del montubio costero ecuatoriano',
                'Fabricación de instrumentos musicales con materiales naturales locales',
            ],
            str_contains($column, 'descripcion') => [
                'Práctica cultural transmitida de generación en generación que refleja la identidad manabita.',
                'Expresión artística con profundas raíces en la tradición montubia de la costa ecuatoriana.',
                'Conocimiento ancestral aplicado en la vida cotidiana de las comunidades rurales costeras.',
                'Manifestación cultural que fortalece los lazos comunitarios y la cohesión social del territorio.',
                'Saber tradicional en riesgo de desaparecer por la migración juvenil hacia zonas urbanas.',
            ],
            str_contains($column, 'sugerencia') => [
                'Mayor transparencia en la rendición de cuentas de los gobiernos locales a la ciudadanía.',
                'Más espacios de participación para jóvenes en la toma de decisiones comunitarias.',
                'Mejorar la difusión de convocatorias a asambleas ciudadanas en medios locales.',
                'Crear plataformas digitales para seguimiento de obras y proyectos públicos.',
                'Fortalecer los presupuestos participativos con mayor asignación de recursos efectivos.',
                'Capacitar a líderes comunitarios en gestión pública y gobernanza local participativa.',
                'Implementar auditorías sociales periódicas a los proyectos en ejecución.',
                'Descentralizar los puntos de atención ciudadana en parroquias rurales alejadas.',
            ],
            str_contains($column, 'comentario') => [
                'El cuidado de menores recae principalmente en las mujeres del hogar familiar.',
                'Necesitamos guarderías públicas accesibles en zonas rurales para las familias.',
                'La carga de trabajo doméstico no es reconocida ni valorada adecuadamente.',
                'Los hombres participan cada vez más en las labores del hogar en la zona.',
                'Se necesitan políticas públicas que reconozcan el trabajo de cuidado no remunerado.',
                'La pandemia incrementó la carga de cuidado en mujeres del sector rural.',
                'Las abuelas son el pilar fundamental del cuidado infantil comunitario.',
                'No hay centros de día para adultos mayores en la parroquia rural.',
            ],
            str_contains($column, 'acciones') => [
                'Implementar sistema de alerta temprana comunitario con sirenas y protocolo definido.',
                'Reforzar estructuras de viviendas vulnerables con materiales sismo-resistentes certificados.',
                'Capacitar brigadas comunitarias de primera respuesta ante emergencias naturales.',
                'Construir muros de contención en zonas de alto riesgo de deslizamiento identificadas.',
                'Establecer rutas de evacuación señalizadas y realizar simulacros periódicos.',
                'Crear reservas comunitarias de agua potable para temporadas de sequía prolongada.',
                'Desarrollar planes familiares de emergencia con kit básico de supervivencia.',
            ],
            default => [
                'Dato registrado durante la jornada de campo.',
                'Información recopilada en visita de seguimiento.',
                'Observación relevante para el análisis territorial.',
            ],
        };

        return $texts[array_rand($texts)];
    }

    // ─────────────────────────────────────────────
    //  FUENTES
    // ─────────────────────────────────────────────

    private function createFuentes(DatasetModel $dataset, array $fuentesConfig): void
    {
        foreach ($fuentesConfig as $i => $fuente) {
            DatasetFuenteModel::create([
                'dataset_id' => $dataset->id,
                'titulo' => $fuente['titulo'],
                'url' => $fuente['url'],
                'descripcion' => $fuente['descripcion'] ?? null,
                'orden' => $i,
            ]);
        }
    }

    // ─────────────────────────────────────────────
    //  GRÁFICOS PREDETERMINADOS
    // ─────────────────────────────────────────────

    private function createGraficosPredeterminados(DatasetModel $dataset, array $variables, $creator, array $graficosConfig): void
    {
        foreach ($graficosConfig as $i => $grafico) {
            $varX = $variables[$grafico['var_x']] ?? null;
            if (!$varX) continue;

            GraficoPredeterminadoModel::create([
                'dataset_id' => $dataset->id,
                'titulo' => $grafico['titulo'],
                'descripcion' => $grafico['descripcion'] ?? null,
                'tipo_grafico' => $grafico['tipo_grafico'],
                'tipo_analisis' => 'univariable',
                'variable_x_id' => $varX->id,
                'variable_y_id' => null,
                'filtros' => null,
                'configuracion' => null,
                'orden' => $i,
                'activo' => true,
                'creado_por' => $creator->id,
            ]);
        }
    }
}
