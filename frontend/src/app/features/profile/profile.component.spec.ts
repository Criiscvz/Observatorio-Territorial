import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EventEmitter } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { ProfileComponent } from './profile.component';
import { AuthService } from '@core/services/auth.service';
import { ProfileService } from '@core/services/profile.service';
import { ThemeService } from '@core/services/theme.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute } from '@angular/router';

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;

  let authServiceSpy: any;
  let profileServiceSpy: any;
  let themeServiceSpy: any;
  let snackBarSpy: any;
  let translateSpy: any;

  const mockUser = {
    id: '1',
    name: 'Test Profile',
    email: 'profile@test.com',
    rol: 'USER',
    perfil: {
      telefono: '123456',
      cargo: 'Tester',
      bio: 'Bio test',
      avatar: null
    }
  };

  beforeEach(async () => {
    authServiceSpy = {
      user: vi.fn().mockReturnValue(mockUser),
      updateUser: vi.fn()
    };
    profileServiceSpy = {
      getProfile: vi.fn().mockReturnValue(of(mockUser)),
      updateProfile: vi.fn(),
      uploadAvatar: vi.fn(),
      deleteAvatar: vi.fn()
    };
    themeServiceSpy = {};
    snackBarSpy = {
      open: vi.fn()
    };
    translateSpy = {
      instant: vi.fn().mockImplementation((k) => k)
    };

    TestBed.overrideComponent(ProfileComponent, {
      remove: { imports: [TranslateModule] },
      add: { imports: [MockTranslatePipe] }
    });

    TestBed.overrideProvider(TranslateService, { useValue: translateSpy });
    TestBed.overrideProvider(AuthService, { useValue: authServiceSpy });
    TestBed.overrideProvider(ProfileService, { useValue: profileServiceSpy });
    
    await TestBed.configureTestingModule({
      imports: [
        ProfileComponent,
        ReactiveFormsModule,
        NoopAnimationsModule
      ],
      providers: [
        FormBuilder,
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    
    // Spy on the real MatSnackBar instance that the component gets
    const snackBar = fixture.debugElement.injector.get(MatSnackBar);
    snackBarSpy = { open: vi.spyOn(snackBar, 'open').mockReturnValue({} as any) };

    fixture.detectChanges();
  });

  it('should create and load profile on init', () => {
    expect(component).toBeTruthy();
    expect(profileServiceSpy.getProfile).toHaveBeenCalled();
    expect(component.user()).toEqual(mockUser);
    expect(component.loading()).toBe(false);
    
    // Check form patch
    expect(component.profileForm.value).toEqual({
      name: 'Test Profile',
      telefono: '123456',
      cargo: 'Tester',
      bio: 'Bio test'
    });
  });

  describe('Form submission', () => {
    it('should not submit if form is invalid', () => {
      component.profileForm.controls['name'].setValue(''); // required
      component.onSubmit();
      expect(profileServiceSpy.updateProfile).not.toHaveBeenCalled();
    });

    it('should submit and update profile if valid', () => {
      const updateData = { name: 'Updated Name', telefono: '999', cargo: 'Dev', bio: 'New Bio' };
      component.profileForm.setValue(updateData);
      
      const updatedUser = { ...mockUser, ...updateData };
      profileServiceSpy.updateProfile.mockReturnValue(of(updatedUser));

      component.onSubmit();

      expect(profileServiceSpy.updateProfile).toHaveBeenCalledWith(updateData);
      expect(authServiceSpy.updateUser).toHaveBeenCalledWith(updatedUser);
      expect(snackBarSpy.open).toHaveBeenCalledWith('profile.messages.updateSuccess', 'common.buttons.close', { duration: 3000 });
      expect(component.saving()).toBe(false);
      expect(component.user()).toEqual(updatedUser);
    });

    it('should handle submit error', () => {
      component.profileForm.setValue({ name: 'Valid', telefono: '', cargo: '', bio: '' });
      profileServiceSpy.updateProfile.mockReturnValue(throwError(() => new Error('Update error')));
      
      component.onSubmit();

      expect(snackBarSpy.open).toHaveBeenCalledWith('profile.messages.updateError', 'common.buttons.close', { duration: 3000 });
      expect(component.saving()).toBe(false);
    });
  });

  describe('Avatar management', () => {
    it('should handle file selection and upload if valid', () => {
      const mockFile = new File([''], 'avatar.png', { type: 'image/png' });
      const mockEvent = { target: { files: [mockFile] } } as any;

      profileServiceSpy.uploadAvatar.mockReturnValue(of(mockUser));

      // Need to mock the nativeElement.value
      component.fileInput = { nativeElement: { value: '' } } as any;

      component.onFileSelected(mockEvent);

      expect(profileServiceSpy.uploadAvatar).toHaveBeenCalledWith(mockFile);
      expect(snackBarSpy.open).toHaveBeenCalledWith('profile.messages.avatarUpdated', 'common.buttons.close', { duration: 3000 });
    });

    it('should reject invalid file types', () => {
      const mockFile = new File([''], 'doc.pdf', { type: 'application/pdf' });
      const mockEvent = { target: { files: [mockFile] } } as any;

      component.onFileSelected(mockEvent);

      expect(profileServiceSpy.uploadAvatar).not.toHaveBeenCalled();
      expect(snackBarSpy.open).toHaveBeenCalledWith('profile.messages.invalidFileType', 'common.buttons.close', { duration: 3000 });
    });

    it('should delete avatar if user has one', () => {
      // Setup mock user with avatar
      const userWithAvatar = { ...mockUser, perfil: { ...mockUser.perfil, avatar: 'url' } };
      component.user.set(userWithAvatar as any);
      
      profileServiceSpy.deleteAvatar.mockReturnValue(of(mockUser));

      component.deleteAvatar();

      expect(profileServiceSpy.deleteAvatar).toHaveBeenCalled();
      expect(authServiceSpy.updateUser).toHaveBeenCalled();
      expect(snackBarSpy.open).toHaveBeenCalledWith('profile.messages.avatarDeleted', 'common.buttons.close', { duration: 3000 });
    });
  });
});
