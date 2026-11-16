<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Profile;

use Illuminate\Foundation\Http\FormRequest;

class UploadAvatarRequest extends FormRequest
{
    public function authorize(): bool { return $this->user() !== null; }

    public function rules(): array
    {
        return ['avatar' => ['bail', 'required', 'file', 'image', 'mimes:jpg,jpeg,png,webp',
            'extensions:jpg,jpeg,png,webp', 'max:2048', 'dimensions:max_width=4096,max_height=4096']];
    }
}
