<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Auth;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/** OAuth browser callbacks keep the existing redirect contract, including errors. */
class GoogleCallbackRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function validationData(): array { return $this->query->all(); }

    public function rules(): array
    {
        return [
            'code' => ['bail', 'required_without:error', 'nullable', 'string', 'max:4096', 'regex:/\A[\x21-\x7E]+\z/D'],
            // The application generates 32 random bytes encoded as unpadded base64url.
            'state' => ['bail', 'required_without:error', 'nullable', 'string', 'size:43', 'regex:/\A[A-Za-z0-9_-]{43}\z/D'],
            'error' => ['bail', 'nullable', 'string', 'max:255', 'regex:/\A[A-Za-z0-9_-]+\z/D'],
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        $query = $this->query->all();
        $reason = isset($query['error']) || ! isset($query['code'], $query['state'])
            || $query['code'] === '' || $query['state'] === '' ? 'cancelled' : 'failed';
        throw new HttpResponseException(redirect()->away(
            rtrim((string) config('app.frontend_url'), '/').'/auth/login?google_error='.$reason));
    }
}
