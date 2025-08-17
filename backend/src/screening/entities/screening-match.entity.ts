// src/screening/entities/
@Entity('screening_matches')
export class ScreeningMatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ScreeningResult)
  screeningResult: ScreeningResult;

  @Column()
  watchlistId: string;

  @Column()
  matchedField: string; // 'name', 'passport', etc.

  @Column()
  matchScore: number; // 0-100 similarity score

  @Column({ type: 'jsonb' })
  matchDetails: any;

  @Column()
  riskLevel: string; // 'low', 'medium', 'high'
}
