import { DataSource } from 'typeorm';
import { LottoDrawEntity } from '../entities/lotto-draw.entity';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// .env 파일 로드
config();

interface LottoDataJson {
  round: number;
  drawDate: string;
  numbers: number[];
  bonusNumber: number;
}

/**
 * JSON 파일에서 로또 데이터를 import
 */
async function importLottoData() {
  // TypeORM DataSource 설정
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'daniel',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'lotto',
    entities: [LottoDrawEntity],
    synchronize: false, // 스크립트 실행 시에는 false
  });

  try {
    // 데이터베이스 연결
    console.log('Connecting to database...');
    await dataSource.initialize();
    console.log('Connected to database');

    // JSON 파일 경로 (커맨드 라인 인자 또는 기본값)
    const jsonFilePath =
      process.argv[2] || path.join(__dirname, '../../lotto-data.json');

    // JSON 파일 존재 확인
    if (!fs.existsSync(jsonFilePath)) {
      console.error(`File not found: ${jsonFilePath}`);
      console.log('\nUsage: yarn import-data <json-file-path>');
      console.log('Example: yarn import-data ./lotto-data.json');
      process.exit(1);
    }

    // JSON 파일 읽기
    console.log(`Reading data from: ${jsonFilePath}`);
    const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
    const lottoData: LottoDataJson[] = JSON.parse(fileContent);

    console.log(`Found ${lottoData.length} rounds to import`);

    // Repository 가져오기
    const lottoDrawRepository = dataSource.getRepository(LottoDrawEntity);

    // 데이터 변환 및 저장
    const entities = lottoData.map((data) => {
      // 유효성 검증
      if (!data.round || !data.drawDate || !data.numbers || !data.bonusNumber) {
        throw new Error(`Invalid data for round ${data.round}`);
      }

      if (data.numbers.length !== 6) {
        throw new Error(
          `Invalid numbers count for round ${data.round}: expected 6, got ${data.numbers.length}`,
        );
      }

      return lottoDrawRepository.create({
        round: data.round,
        drawDate: data.drawDate,
        numbers: data.numbers.sort((a, b) => a - b),
        bonusNumber: data.bonusNumber,
      });
    });

    // 배치 저장 (upsert)
    console.log('Saving data to database...');
    await lottoDrawRepository.save(entities);

    console.log(`Successfully imported ${entities.length} rounds`);

    // 통계 출력
    const totalCount = await lottoDrawRepository.count();
    const minRound = await lottoDrawRepository
      .createQueryBuilder('draw')
      .orderBy('draw.round', 'ASC')
      .limit(1)
      .getOne();
    const maxRound = await lottoDrawRepository
      .createQueryBuilder('draw')
      .orderBy('draw.round', 'DESC')
      .limit(1)
      .getOne();

    console.log('\nDatabase statistics:');
    console.log(`  Total rounds: ${totalCount}`);
    console.log(`  First round: ${minRound?.round} (${minRound?.drawDate})`);
    console.log(`  Latest round: ${maxRound?.round} (${maxRound?.drawDate})`);
  } catch (error) {
    console.error('Error importing data:', error.message);
    if (error.detail) {
      console.error('Details:', error.detail);
    }
    process.exit(1);
  } finally {
    // 데이터베이스 연결 종료
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('\nDatabase connection closed');
    }
  }
}

// 스크립트 실행
importLottoData();
