<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\SharePoint;

use App\Models\Departamento;
use App\Support\Authorization\PublicationDepartmentAccess;
use Illuminate\Foundation\Http\FormRequest;

abstract class SharePointRequest extends FormRequest
{
    public function authorize(PublicationDepartmentAccess $access): bool
    {
        if (! $this->user()?->isAdmin()) return false;
        $department = $this->route('departamento');
        if ($department instanceof Departamento) $access->ensure($this->user(), $department);
        return true;
    }
}
