<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ObservatoryIdentityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Schema::create('users', function(Blueprint $t){$t->id();$t->string('name');$t->string('email');$t->string('rol');$t->softDeletes();});
        DB::table('users')->insert(['id'=>1,'name'=>'Admin','email'=>'qa@example.test','rol'=>'ADMIN']);
        Schema::create('departamentos', function(Blueprint $t){$t->uuid('id')->primary();$t->string('nombre');$t->string('codigo_interno')->unique();$t->text('descripcion')->nullable();$t->string('icono')->nullable();$t->boolean('publico')->default(false);$t->timestamps();$t->softDeletes();});
        (require database_path('migrations/2026_10_28_000002_add_observatory_photo.php'))->up();
        Schema::create('usuario_departamento',function(Blueprint $t){$t->uuid('id')->primary();$t->unsignedBigInteger('user_id');$t->uuid('departamento_id');$t->string('rol');$t->boolean('puede_revisar')->default(false);$t->boolean('puede_agregar_editores')->default(false);$t->timestamps();});
        Schema::create('datasets',function(Blueprint $t){$t->uuid('id')->primary();$t->uuid('departamento_id');foreach(['nombre','nombre_archivo','descripcion','estado'] as $s)$t->string($s)->nullable();$t->integer('total_registros')->default(0);$t->timestamp('fecha_carga')->nullable();$t->timestamps();$t->softDeletes();});
        $this->signIn('ADMIN');
    }
    private function signIn(string $role):void {Sanctum::actingAs((new User)->forceFill(['id'=>1,'rol'=>$role,'is_active'=>true]));}
    private function payload():array {return ['nombre'=>'Observatorio de prueba','codigo_interno'=>'QA-IDENTIDAD','icono'=>'eco','publico'=>true];}
    public function test_photo_is_normalized_persisted_and_visible_in_public_and_admin_reads():void
    {
        $response=$this->post('/api/departamentos',array_replace($this->payload(),['publico'=>'1','foto'=>UploadedFile::fake()->image('foto.png',900,600)]),['Accept'=>'application/json'])->assertCreated();
        $id=$response->json('id');$photo=$response->json('foto_url');
        $this->assertStringStartsWith('data:image/jpeg;base64,',$photo);
        $bytes=base64_decode(explode(',',$photo,2)[1]);$info=getimagesizefromstring($bytes);$this->assertSame([400,400],[$info[0],$info[1]]);
        $this->assertLessThan(240000,strlen($photo));
        $this->getJson("/api/departamentos/$id")->assertOk()->assertJsonPath('foto_url',$photo);
        $this->getJson("/api/publico/departamentos/$id")->assertOk()->assertJsonPath('foto_url',$photo);
        $this->putJson("/api/departamentos/$id",['nombre'=>'Nombre actualizado'])->assertOk()->assertJsonPath('foto_url',$photo);
        $this->putJson("/api/departamentos/$id",['icono'=>'groups','eliminar_foto'=>true])->assertOk()->assertJsonPath('foto_url',null)->assertJsonPath('icono','groups');
        $this->getJson("/api/publico/departamentos/$id")->assertOk()->assertJsonPath('foto_url',null);
    }
    public function test_update_accepts_multipart_method_override_and_replaces_photo():void
    {
        $id=$this->postJson('/api/departamentos',$this->payload())->assertCreated()->json('id');
        $this->post("/api/departamentos/$id",['_method'=>'PUT','foto'=>UploadedFile::fake()->image('nueva.jpg',450,600)],['Accept'=>'application/json'])->assertOk()->assertJson(fn($json)=>$json->where('id',$id)->where('foto_url',fn($value)=>str_starts_with($value,'data:image/jpeg;base64,'))->etc());
    }
    public function test_invalid_or_oversized_images_do_not_create_or_modify_records():void
    {
        foreach([UploadedFile::fake()->create('bad.svg',1,'image/svg+xml'),UploadedFile::fake()->image('large.png',5000,10),UploadedFile::fake()->image('big.jpg')->size(2049)] as $file){
            $this->post('/api/departamentos',$this->payload()+['foto'=>$file],['Accept'=>'application/json'])->assertUnprocessable()->assertJsonValidationErrors('foto');
        }
        $this->assertSame(0,DB::table('departamentos')->count());
        $id=$this->postJson('/api/departamentos',$this->payload())->assertCreated()->json('id');
        $this->putJson("/api/departamentos/$id",['foto'=>'data:image/svg+xml,<svg/>'])->assertUnprocessable();
        $this->assertNull(DB::table('departamentos')->where('id',$id)->value('foto'));
    }
    public function test_only_global_administrators_can_change_identity_and_private_photos_stay_private():void
    {
        $id=$this->postJson('/api/departamentos',array_replace($this->payload(),['publico'=>false]))->assertCreated()->json('id');
        $this->getJson("/api/publico/departamentos/$id")->assertNotFound();
        foreach(['EDITOR','ADMIN_OBSERVATORIO','USER'] as $role){$this->signIn($role);$this->putJson("/api/departamentos/$id",['eliminar_foto'=>true])->assertForbidden();$this->postJson('/api/departamentos',$this->payload())->assertForbidden();}
    }
}
