import { Controller, Get, Put, Body, Param, HttpException, HttpStatus, Logger } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger"
import { type UpdateUserProfileDto, UserProfileResponseDto, ProfileInsightsDto } from "../dto/user-profile.dto"
import type { Repository } from "typeorm"
import type { UserFinancialProfile, TransactionAnalysis } from "../entities"

@ApiTags("User Profile")
@Controller("user-profile")
export class UserProfileController {
  private readonly logger = new Logger(UserProfileController.name)

  constructor(
    private readonly profileRepository: Repository<UserFinancialProfile>,
    private readonly analysisRepository: Repository<TransactionAnalysis>,
  ) {}

  @Get(":userId")
  @ApiOperation({ summary: "Get user financial profile" })
  @ApiParam({ name: "userId", description: "User ID" })
  @ApiResponse({
    status: 200,
    description: "User profile retrieved successfully",
    type: UserProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: "User profile not found" })
  async getUserProfile(@Param("userId") userId: string): Promise<UserProfileResponseDto> {
    try {
      const profile = await this.profileRepository.findOne({
        where: { userId },
      })

      if (!profile) {
        throw new HttpException("User profile not found", HttpStatus.NOT_FOUND)
      }

      return profile
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }

      this.logger.error(`Error retrieving profile for user ${userId}:`, error)
      throw new HttpException("Failed to retrieve user profile", HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Put(":userId")
  @ApiOperation({ summary: "Update user financial profile" })
  @ApiParam({ name: "userId", description: "User ID" })
  @ApiResponse({
    status: 200,
    description: "User profile updated successfully",
    type: UserProfileResponseDto,
  })
  async updateUserProfile(
    @Param("userId") userId: string,
    @Body() updateDto: UpdateUserProfileDto,
  ): Promise<UserProfileResponseDto> {
    try {
      let profile = await this.profileRepository.findOne({
        where: { userId },
      })

      if (!profile) {
        // Create new profile if it doesn't exist
        profile = this.profileRepository.create({
          userId,
          ...updateDto,
        })
      } else {
        // Update existing profile
        Object.assign(profile, updateDto)
      }

      const savedProfile = await this.profileRepository.save(profile)

      this.logger.log(`Updated profile for user ${userId}`)

      return savedProfile
    } catch (error) {
      this.logger.error(`Error updating profile for user ${userId}:`, error)
      throw new HttpException("Failed to update user profile", HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get(":userId/insights")
  @ApiOperation({ summary: "Get user profile insights and recommendations" })
  @ApiParam({ name: "userId", description: "User ID" })
  @ApiResponse({
    status: 200,
    description: "Profile insights retrieved successfully",
    type: ProfileInsightsDto,
  })
  async getProfileInsights(@Param("userId") userId: string): Promise<ProfileInsightsDto> {
    try {
      const profile = await this.profileRepository.findOne({
        where: { userId },
      })

      if (!profile) {
        throw new HttpException("User profile not found", HttpStatus.NOT_FOUND)
      }

      // Get recent analyses for additional insights
      const recentAnalyses = await this.analysisRepository.find({
        where: { userId },
        order: { createdAt: "DESC" },
        take: 50,
      })

      // Generate insights
      const insights = this.generateProfileInsights(profile, recentAnalyses)

      return insights
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }

      this.logger.error(`Error generating insights for user ${userId}:`, error)
      throw new HttpException("Failed to generate profile insights", HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  private generateProfileInsights(profile: UserFinancialProfile, analyses: TransactionAnalysis[]): ProfileInsightsDto {
    const insights: string[] = []
    const recommendations: string[] = []
    const riskFactors: string[] = []
    const strengths: string[] = []
    const improvements: string[] = []

    let healthScore = 70 // Base score

    // Analyze income stability
    if (profile.incomeStability === "stable") {
      strengths.push("Stable income pattern")
      healthScore += 10
    } else if (profile.incomeStability === "declining") {
      riskFactors.push("Declining income trend")
      improvements.push("Address income stability issues")
      healthScore -= 15
    }

    // Analyze debt-to-income ratio
    if (profile.debtToIncomeRatio) {
      if (profile.debtToIncomeRatio < 0.3) {
        strengths.push("Healthy debt-to-income ratio")
        healthScore += 10
      } else if (profile.debtToIncomeRatio > 0.5) {
        riskFactors.push("High debt-to-income ratio")
        recommendations.push("Consider debt reduction strategies")
        healthScore -= 20
      }
    }

    // Analyze spending behavior
    if (profile.spendingBehavior === "conservative") {
      strengths.push("Conservative spending approach")
      healthScore += 5
    } else if (profile.spendingBehavior === "impulsive") {
      riskFactors.push("Impulsive spending patterns")
      improvements.push("Develop better spending discipline")
      healthScore -= 10
    }

    // Analyze risk scores
    if (profile.riskScore && profile.riskScore > 70) {
      riskFactors.push("High overall risk score")
      healthScore -= 15
    }

    if (profile.fraudScore && profile.fraudScore > 50) {
      riskFactors.push("Elevated fraud risk indicators")
      recommendations.push("Review recent transactions for suspicious activity")
    }

    // Analyze recent transaction patterns
    const highRiskAnalyses = analyses.filter((a) => a.riskLevel === "high" || a.riskLevel === "critical")
    if (highRiskAnalyses.length > 5) {
      riskFactors.push("Multiple high-risk transactions detected")
      recommendations.push("Review transaction patterns and security measures")
    }

    // Generate general insights
    if (profile.monthlyIncome && profile.monthlyExpenses) {
      const savingsRate = (profile.monthlyIncome - profile.monthlyExpenses) / profile.monthlyIncome
      if (savingsRate > 0.2) {
        strengths.push("Good savings rate")
        insights.push(`Saving ${(savingsRate * 100).toFixed(1)}% of income`)
      } else if (savingsRate < 0) {
        riskFactors.push("Spending exceeds income")
        recommendations.push("Reduce expenses or increase income")
      }
    }

    // Add general recommendations
    if (improvements.length === 0 && riskFactors.length === 0) {
      recommendations.push("Continue maintaining healthy financial habits")
    }

    if (analyses.length < 10) {
      recommendations.push("More transaction history needed for better insights")
    }

    return {
      userId: profile.userId,
      healthScore: Math.max(0, Math.min(100, healthScore)),
      insights,
      recommendations,
      riskFactors,
      strengths,
      improvements,
    }
  }
}
