<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Dataset;

use Illuminate\Foundation\Http\FormRequest;
use App\Rules\{DatabaseText, ImportValueList};
use App\Domain\Dataset\ImportLimits;

class ConfirmImportRequest extends FormRequest
{
    public const MAX_COLUMNS = ImportLimits::MAX_COLUMNS;

    public function authorize(): bool
    {
        return $this->user()?->isAdmin() === true;
    }

    public function rules(): array
    {
        $columns = $this->input('columnas');
        $rules = ['columnas' => ['bail', 'required', 'array', 'list', 'min:1', 'max:'.self::MAX_COLUMNS,
            function (string $attribute, mixed $value, \Closure $fail): void {
                if (! is_array($value)) return;
                $json = json_encode($value, JSON_UNESCAPED_UNICODE);
                if ($json === false || strlen($json) > ImportLimits::MAX_METADATA_BYTES) $fail('Las columnas no deben superar 256 KiB de datos válidos.');
            }]];
        // Oversized/non-list inputs must not expand wildcard rules or nested validations.
        if (! is_array($columns) || ! array_is_list($columns) || count($columns) > self::MAX_COLUMNS) return $rules;
        $encoded = json_encode($columns, JSON_UNESCAPED_UNICODE);
        if ($encoded === false || strlen($encoded) > ImportLimits::MAX_METADATA_BYTES) return $rules;
        return $rules + [
            'columnas.*' => ['bail', 'required', 'array:nombre_columna,nombre_original,tipo_dato,tipo_detectado,es_visible,orden,opciones,muestra_valores'],
            'columnas.*.nombre_columna' => ['bail', 'required', 'string', 'max:255',
                'regex:/\A[A-Za-z_][A-Za-z0-9_]*\z/D', 'distinct:strict'],
            'columnas.*.nombre_original' => ['bail', 'required', 'string', 'max:255', new DatabaseText],
            'columnas.*.tipo_dato' => ['bail', 'required', 'string', 'in:NUMERICO,CATEGORICO,FECHA,TEXTO'],
            'columnas.*.tipo_detectado' => ['bail', 'required', 'string', 'in:NUMERICO,CATEGORICO,FECHA,TEXTO'],
            'columnas.*.es_visible' => ['bail', 'sometimes', 'boolean'],
            // Repository ordering remains the submitted list order; this transport field is retained.
            'columnas.*.orden' => ['bail', 'sometimes', 'integer', 'min:0', 'max:2147483647'],
            'columnas.*.opciones' => ['bail', 'nullable', 'array', new ImportValueList],
            'columnas.*.muestra_valores' => ['bail', 'nullable', 'array', new ImportValueList(5)],
        ];
    }

    public function messages(): array
    {
        return [
            'columnas.required' => 'Debe especificar las columnas a importar',
            'columnas.*.nombre_columna.required' => 'El nombre de columna es obligatorio',
            'columnas.*.tipo_dato.in' => 'Tipo de dato inválido',
        ];
    }
}
