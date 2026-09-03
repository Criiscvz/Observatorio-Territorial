<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Backward compatibility: every account created before this deployment
        // keeps its current access, even if it never had to verify email.
        DB::table('users')->whereNull('email_verified_at')->update([
            'email_verified_at' => now(),
        ]);

        Schema::table('users', function (Blueprint $table) {
            $table->string('google_id')->nullable()->unique();
        });

        Schema::create('email_verification_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('code_hash');
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });

        Schema::create('oauth_login_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('code_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('oauth_login_codes');
        Schema::dropIfExists('email_verification_codes');

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['google_id']);
            $table->dropColumn('google_id');
        });
    }
};
