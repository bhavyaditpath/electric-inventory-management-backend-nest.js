import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PassportModule } from "@nestjs/passport";
import { JwtModule, JwtModuleOptions } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { User } from "../user/entities/user.entity";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User]),
    PassportModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET is not defined');

        const rawExpires = config.get<string>('JWT_EXPIRES_IN'); // e.g. "7d" or "3600"
        let expiresIn: number | string | undefined;

        if (rawExpires) {
          const asNumber = Number(rawExpires);
          expiresIn = Number.isNaN(asNumber) ? rawExpires : asNumber;
        }

        // Final object explicitly typed as JwtModuleOptions
        return {
          secret,
          signOptions: {
            expiresIn,
          },
        } as JwtModuleOptions;
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
