import {TotpSection} from './AccountSettings';
import {PageHead} from './ui';
import type {User} from './shared';

// Doctors and administrators cannot work until a second factor is on, so the setup is the whole page rather than a block under the password form.
export function SecondFactorPage({user}:{user:User}){
 return <section className="second-factor">
  <PageHead title="Включите вход с кодом" description="Для кабинета врача и администратора нужен второй фактор: код из приложения-аутентификатора. Настройте его здесь, затем кабинет откроется."/>
  <TotpSection user={user} forced/>
 </section>;
}
