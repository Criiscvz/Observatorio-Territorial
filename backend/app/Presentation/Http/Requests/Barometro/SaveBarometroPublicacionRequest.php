<?php

namespace App\Presentation\Http\Requests\Barometro;

use App\Models\BarometroPublicacion;
use App\Presentation\Http\Requests\Publicacion\PublicationInputRules;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveBarometroPublicacionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'titulo' => PublicationInputRules::text(255, true),
            'fecha_publicacion' => ['bail', 'required', 'date_format:Y-m-d', 'after_or_equal:0001-01-01', 'before_or_equal:9999-12-31'],
            'fuente' => PublicationInputRules::text(255),
            'descripcion' => PublicationInputRules::text(3000),
            'estado' => ['required', Rule::in(BarometroPublicacion::STATES)],
            'archivo' => ['prohibited'],
            'link_url' => [...PublicationInputRules::text(2048, true), 'url:https', $this->validatePowerBiLink(...)],
        ];
    }

    private function validatePowerBiLink(string $attribute, string $value, Closure $fail): void
    {
        $parts = parse_url($value);
        if ($parts === false
            || strtolower($parts['host'] ?? '') !== 'app.powerbi.com'
            || ($parts['path'] ?? '') !== '/view'
            || isset($parts['user']) || isset($parts['pass'])
            || (isset($parts['port']) && $parts['port'] !== 443)
            || ! $this->hasReportToken($parts['query'] ?? '')) {
            $fail('Pega el enlace público de visualización de Power BI (app.powerbi.com/view).');
        }
    }

    private function hasReportToken(string $query): bool
    {
        foreach (explode('&', $query) as $parameter) {
            [$key, $value] = array_pad(explode('=', $parameter, 2), 2, '');
            if (urldecode($key) === 'r') {
                return urldecode($value) !== '';
            }
        }

        return false;
    }
}
