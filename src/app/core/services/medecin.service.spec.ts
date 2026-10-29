import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { MedecinJuniorResponse } from '../models/medecin.model';
import { MedecinService } from './medecin.service';

const URL_JUNIORS = `${environment.api.auth}/api/auth/medecins-juniors`;

describe('MedecinService', () => {
  let service: MedecinService;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(
      'proxymed.session',
      JSON.stringify({
        badge: 'badge-senior',
        role: 'MEDECIN_SENIOR',
        email: 'senior@proxymed.fr',
        expireLe: Date.now() + 3_600_000,
        motDePasseTemporaire: false,
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    service = TestBed.inject(MedecinService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('lit les juniors actifs sur le service d’authentification, avec le badge', () => {
    const juniors: MedecinJuniorResponse[] = [
      { id: 'j-1', nomComplet: 'Dr Aminata Sow' },
      { id: 'j-2', nomComplet: 'Dr Ibrahima Fall' },
    ];
    let recus: MedecinJuniorResponse[] | undefined;
    service.juniors().subscribe((j) => (recus = j));

    const requete = http.expectOne(URL_JUNIORS);
    expect(requete.request.url).toBe('http://localhost:8083/api/auth/medecins-juniors');
    expect(requete.request.method).toBe('GET');
    expect(requete.request.headers.get('Authorization')).toBe('Bearer badge-senior');
    requete.flush(juniors);
    expect(recus).toEqual(juniors);
  });
});
