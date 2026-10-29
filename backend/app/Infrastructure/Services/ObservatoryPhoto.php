<?php

declare(strict_types=1);
namespace App\Infrastructure\Services;

use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class ObservatoryPhoto
{
    /** Normalize small identity images into a durable, bounded database thumbnail. */
    public function data(Request $request): ?string
    {
        if (!$request->hasFile('foto')) return $request->boolean('eliminar_foto') ? '' : null;
        $file = $request->file('foto');
        $image = @imagecreatefromstring($file->get());
        if (!$image) throw ValidationException::withMessages(['foto' => 'No se pudo leer esta imagen.']);
        try {
            $width = imagesx($image); $height = imagesy($image); $side = min($width, $height);
            $thumbnail = imagecreatetruecolor(400, 400);
            try {
                imagefill($thumbnail, 0, 0, imagecolorallocate($thumbnail, 255, 255, 255));
                imagecopyresampled($thumbnail, $image, 0, 0, (int)(($width - $side) / 2), (int)(($height - $side) / 2), 400, 400, $side, $side);
                ob_start(); imagejpeg($thumbnail, null, 85); $bytes = ob_get_clean();
                return 'data:image/jpeg;base64,'.base64_encode($bytes);
            } finally { imagedestroy($thumbnail); }
        } finally { imagedestroy($image); }
    }
}
