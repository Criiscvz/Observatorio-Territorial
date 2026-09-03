<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use OpenApi\Attributes as OA;
use App\Application\Auth\DTOs\LoginDTO;
use App\Application\Auth\DTOs\RegisterDTO;
use App\Application\Auth\UseCases\GetCurrentUserUseCase;
use App\Application\Auth\UseCases\LoginUseCase;
use App\Application\Auth\UseCases\LogoutUseCase;
use App\Application\Auth\UseCases\RegisterUseCase;
use App\Application\Auth\DTOs\AuthResponseDTO;
use App\Application\Auth\Services\EmailVerificationService;
use App\Application\Auth\Services\GoogleOAuthService;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Presentation\Http\Requests\Auth\GoogleCodeExchangeRequest;
use App\Presentation\Http\Requests\Auth\LoginRequest;
use App\Presentation\Http\Requests\Auth\ResendVerificationCodeRequest;
use App\Presentation\Http\Requests\Auth\RegisterRequest;
use App\Presentation\Http\Requests\Auth\VerifyEmailCodeRequest;
use App\Presentation\Http\Resources\Auth\AuthResource;
use App\Presentation\Http\Resources\Auth\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

#[OA\Tag(name: 'Auth', description: 'Endpoints de autenticación')]
class AuthController extends Controller
{
    public function __construct(
        private readonly LoginUseCase $loginUseCase,
        private readonly RegisterUseCase $registerUseCase,
        private readonly LogoutUseCase $logoutUseCase,
        private readonly GetCurrentUserUseCase $getCurrentUserUseCase,
        private readonly EmailVerificationService $emailVerificationService,
        private readonly GoogleOAuthService $googleOAuthService,
    ) {}

    #[OA\Post(
        path: '/login',
        summary: 'Iniciar sesión',
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['email', 'password'],
                properties: [
                    new OA\Property(property: 'email', type: 'string', format: 'email', example: 'admin@example.com'),
                    new OA\Property(property: 'password', type: 'string', format: 'password', example: 'password123')
                ]
            )
        ),
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 200, description: 'Login exitoso'),
            new OA\Response(response: 422, description: 'Credenciales inválidas')
        ]
    )]
    public function login(LoginRequest $request): JsonResponse
    {
        $dto = LoginDTO::fromArray($request->validated());
        $result = $this->loginUseCase->execute($dto);

        return response()->json(new AuthResource($result));
    }

    #[OA\Post(
        path: '/register',
        summary: 'Registrar nuevo usuario',
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'email', 'password', 'password_confirmation'],
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'John Doe'),
                    new OA\Property(property: 'email', type: 'string', format: 'email', example: 'user@example.com'),
                    new OA\Property(property: 'password', type: 'string', format: 'password', example: 'password123'),
                    new OA\Property(property: 'password_confirmation', type: 'string', format: 'password', example: 'password123')
                ]
            )
        ),
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 201, description: 'Registro exitoso'),
            new OA\Response(response: 422, description: 'Datos inválidos')
        ]
    )]
    public function register(RegisterRequest $request): JsonResponse
    {
        $dto = RegisterDTO::fromArray($request->validated());
        $user = $this->registerUseCase->execute($dto);
        $emailSent = true;

        try {
            $this->emailVerificationService->send($user, false);
        } catch (Throwable $e) {
            $emailSent = false;
            Log::warning('Verification email delivery failed.', [
                'user_id' => $user->id,
                'exception' => $e::class,
            ]);
        }

        return response()->json([
            'message' => $emailSent
                ? 'Cuenta creada. Revisa tu correo para obtener el código de verificación.'
                : 'Cuenta creada. No pudimos enviar el correo; solicita un nuevo código.',
            'verification_required' => true,
            'email' => $user->email,
            'email_sent' => $emailSent,
            'resend_after' => $emailSent ? EmailVerificationService::RESEND_COOLDOWN_SECONDS : 0,
        ], 201);
    }

    public function verifyEmailCode(VerifyEmailCodeRequest $request): JsonResponse
    {
        $email = Str::lower(trim((string) $request->validated('email')));
        $user = User::query()->whereRaw('LOWER(email) = ?', [$email])->first();

        if (!$user) {
            throw ValidationException::withMessages([
                'code' => ['El código expiró o ya no es válido.'],
            ]);
        }

        $verifiedUser = $this->emailVerificationService->verify(
            $user,
            (string) $request->validated('code'),
        );

        return response()->json(new AuthResource($this->createAuthResponse($verifiedUser)));
    }

    public function resendVerificationCode(ResendVerificationCodeRequest $request): JsonResponse
    {
        $email = Str::lower(trim((string) $request->validated('email')));
        $user = User::query()->whereRaw('LOWER(email) = ?', [$email])->first();

        if ($user && $user->email_verified_at === null) {
            try {
                $this->emailVerificationService->send($user);
            } catch (Throwable $e) {
                Log::warning('Verification email resend failed.', [
                    'user_id' => $user->id,
                    'exception' => $e::class,
                ]);
            }
        }

        return response()->json([
            'message' => 'Si la cuenta requiere verificación, recibirás un nuevo código.',
            'resend_after' => EmailVerificationService::RESEND_COOLDOWN_SECONDS,
        ]);
    }

    public function googleRedirect(): JsonResponse
    {
        try {
            return response()->json(['url' => $this->googleOAuthService->authorizationUrl()]);
        } catch (Throwable $e) {
            Log::warning('Google OAuth could not start.', ['exception' => $e::class]);
            return response()->json(['message' => 'Google no está disponible en este momento.'], 503);
        }
    }

    public function googleCallback(Request $request): RedirectResponse
    {
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');

        if ($request->filled('error') || !$request->filled(['code', 'state'])) {
            return redirect()->away($frontendUrl.'/auth/login?google_error=cancelled');
        }

        try {
            $loginCode = $this->googleOAuthService->handleCallback(
                (string) $request->query('code'),
                (string) $request->query('state'),
            );

            return redirect()->away($frontendUrl.'/auth/google/callback?code='.rawurlencode($loginCode));
        } catch (Throwable $e) {
            Log::warning('Google OAuth callback failed.', ['exception' => $e::class]);
            return redirect()->away($frontendUrl.'/auth/login?google_error=failed');
        }
    }

    public function googleExchange(GoogleCodeExchangeRequest $request): JsonResponse
    {
        try {
            $user = $this->googleOAuthService->consumeLoginCode((string) $request->validated('code'));
        } catch (Throwable $e) {
            return response()->json(['message' => 'El acceso de Google expiró o no es válido.'], 422);
        }

        return response()->json(new AuthResource($this->createAuthResponse($user)));
    }

    #[OA\Post(
        path: '/logout',
        summary: 'Cerrar sesión',
        security: [['sanctum' => []]],
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 200, description: 'Logout exitoso')
        ]
    )]
    public function logout(Request $request): JsonResponse
    {
        $this->logoutUseCase->execute($request->user());

        return response()->json(['message' => 'Sesión cerrada exitosamente']);
    }

    #[OA\Get(
        path: '/user',
        summary: 'Obtener usuario actual',
        security: [['sanctum' => []]],
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 200, description: 'Datos del usuario')
        ]
    )]
    public function user(Request $request): JsonResponse
    {
        $user = $this->getCurrentUserUseCase->execute($request->user());

        return response()->json(new UserResource($user));
    }

    private function createAuthResponse(User $user): AuthResponseDTO
    {
        $user->tokens()->delete();
        $user->load(['perfil', 'departamentos']);
        $role = strtoupper((string) ($user->rol ?? 'USER'));
        $durationMinutes = in_array($role, ['ADMIN', 'EDITOR'], true) ? 480 : 1440;
        $expiresAt = now()->addMinutes($durationMinutes);
        $token = $user->createToken('auth-token', ['*'], $expiresAt)->plainTextToken;

        return AuthResponseDTO::fromUser($user, $token, $expiresAt, $durationMinutes * 60);
    }
}
