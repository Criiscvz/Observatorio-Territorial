<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Eloquent\Repositories;

use App\Domain\User\Entities\User;
use App\Domain\User\Repositories\UserRepositoryInterface;
use App\Infrastructure\Persistence\Eloquent\Models\UserModel;
use Illuminate\Support\Str;

class EloquentUserRepository implements UserRepositoryInterface
{
    public function __construct(
        private readonly UserModel $model
    ) {}

    public function findById(int $id): ?User
    {
        $model = $this->model->find($id);
        
        return $model ? $this->toDomain($model) : null;
    }

    public function findByEmail(string $email): ?User
    {
        $model = $this->model->where('email', $email)->first();
        
        return $model ? $this->toDomain($model) : null;
    }

    public function save(User $user): User
    {
        $model = $this->model->create([
            'name' => $user->name,
            'email' => $user->email,
            'password' => $user->password,
        ]);

        return $this->toDomain($model);
    }

    public function update(User $user): User
    {
        $model = $this->model->findOrFail($user->id);
        
        $data = [
            'name' => $user->name,
            'email' => $user->email,
        ];
        
        if ($user->password) {
            $data['password'] = $user->password;
        }
        
        $model->update($data);

        return $this->toDomain($model->fresh());
    }

    public function delete(int $id): bool
    {
        return $this->model->find($id)?->delete() ?? false;
    }

    public function attachDepartamento(int $userId, string $departamentoId, string $rol): void
    {
        $model = $this->model->findOrFail($userId);
        
        $model->departamentos()->attach($departamentoId, [
            'id' => Str::uuid()->toString(),
            'rol' => $rol,
        ]);
    }

    public function detachDepartamento(int $userId, string $departamentoId): void
    {
        $model = $this->model->findOrFail($userId);
        
        $model->departamentos()->detach($departamentoId);
    }

    private function toDomain(UserModel $model): User
    {
        return new User(
            id: $model->id,
            name: $model->name,
            email: $model->email,
            password: null, // No devolvemos la contraseña
            emailVerifiedAt: $model->email_verified_at ? new \DateTimeImmutable($model->email_verified_at->toDateTimeString()) : null,
            createdAt: $model->created_at ? new \DateTimeImmutable($model->created_at->toDateTimeString()) : null,
            updatedAt: $model->updated_at ? new \DateTimeImmutable($model->updated_at->toDateTimeString()) : null,
        );
    }

    /**
     * Get the Eloquent model for auth purposes
     */
    public function getEloquentModel(int $id): ?UserModel
    {
        return $this->model->find($id);
    }
}
