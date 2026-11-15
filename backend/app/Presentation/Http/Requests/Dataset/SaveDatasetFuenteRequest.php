<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Dataset;

use App\Infrastructure\Persistence\Eloquent\Models\DatasetFuenteModel;
use App\Support\Authorization\DepartamentoResourceAuthorizer;

class SaveDatasetFuenteRequest extends DatasetMutationRequest
{
    private string $managedDatasetId;
    private ?DatasetFuenteModel $managedSource = null;

    public function authorize(DepartamentoResourceAuthorizer $authorizer): bool
    {
        if (! $this->user()) return false;

        if ($this->isMethod('post')) {
            $datasetId = (string) $this->route('datasetId');
        } else {
            $this->managedSource = DatasetFuenteModel::find($this->route('id'));
            abort_unless($this->managedSource, 404, 'Fuente no encontrada');
            $datasetId = $this->managedSource->dataset_id;
        }

        $this->managedDatasetId = $authorizer->findManagedDataset($this->user(), $datasetId)->id;

        return true;
    }

    protected function prepareForValidation(): void
    {
        $url = $this->input('url');
        if (! is_string($url) || $url === '') return;

        if (str_starts_with($url, '//')) {
            $url = 'https:'.$url;
        } elseif (! preg_match('#^[a-z][a-z0-9+.-]*:#i', $url)
            || preg_match('~^[^:/?#]+:\d+(?:[/?#]|$)~', $url)) {
            $url = 'https://'.$url;
        }

        $this->merge(['url' => $url]);
    }

    public function rules(): array
    {
        $presence = $this->isMethod('post') ? [] : ['sometimes'];

        return [
            'titulo' => [...$presence, ...$this->textRules(255, true)],
            // The persisted column is varchar(255), including the normalized scheme.
            'url' => [...$presence, ...$this->textRules(255, true), 'url:http,https'],
            'descripcion' => $this->textRules(500),
            'orden' => ['bail', 'sometimes', 'required', 'integer', 'min:0', 'max:2147483647'],
        ];
    }

    public function datasetId(): string
    {
        return $this->managedDatasetId;
    }

    public function fuente(): DatasetFuenteModel
    {
        abort_unless($this->managedSource, 404, 'Fuente no encontrada');

        return $this->managedSource;
    }
}
