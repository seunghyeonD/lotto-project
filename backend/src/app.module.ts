import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LottoController } from './controllers/lotto.controller';
import { LottoDataService } from './services/lotto-data.service';
import { LottoApiService } from './services/lotto-api.service';
import { CombinationService } from './services/combination.service';
import { ScraperService } from './services/scraper.service';
import { LottoDrawEntity } from './entities/lotto-draw.entity';

@Module({
  imports: [
    // 환경변수 설정
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // TypeORM 설정
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [LottoDrawEntity],
        synchronize: true, // 개발 환경에서만 true, 프로덕션에서는 false
        logging: false,
      }),
      inject: [ConfigService],
    }),
    // 엔티티 등록
    TypeOrmModule.forFeature([LottoDrawEntity]),
  ],
  controllers: [AppController, LottoController],
  providers: [
    AppService,
    LottoDataService,
    LottoApiService,
    CombinationService,
    ScraperService,
  ],
})
export class AppModule {}
